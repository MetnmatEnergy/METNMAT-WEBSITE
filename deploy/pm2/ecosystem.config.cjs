/**
 * PM2 process definitions for the applications METNMAT runs on the shared EC2.
 *
 * This file is deployed to /home/ec2-user/web/ecosystem.config.cjs and is the
 * ONLY place process-level settings belong. It deliberately does NOT define the
 * command-center dashboard: that app is deployed from its own repository and
 * owns its own PM2 entry. Defining it here would let a website deploy restart
 * it.
 *
 * Start one app:   pm2 start ecosystem.config.cjs --only metnmat-website
 * Reload one app:  pm2 reload metnmat-website
 * NEVER:           pm2 restart all   ← bounces the dashboard too
 *
 * .cjs, not .js: the repo is ESM ("type": "module"), and PM2 requires CommonJS.
 */

// Bind to loopback only. The apps are reachable through Caddy and must never be
// directly addressable from the internet, which would bypass TLS and the
// security headers Caddy adds.
const LOOPBACK = "127.0.0.1";

module.exports = {
  apps: [
    {
      name: "metnmat-website",
      // Started through the secrets wrapper, which loads metnmat/prod/* from
      // Secrets Manager and then execs node. See deploy/bin/with-secrets.sh.
      script: "/home/ec2-user/web/bin/with-secrets.sh",
      interpreter: "/bin/bash",
      args: "node apps/website/server.js",
      // `cwd` is the symlink, not the resolved release directory, so a rollback
      // that moves the symlink takes effect on reload without rewriting this
      // file. It is also what makes the relative path in `args` resolve.
      cwd: "/home/ec2-user/web/current",
      // fork, not cluster. Cluster mode would fork N copies of a ~500 MB
      // process on a 2 GB box for no benefit at this traffic level.
      exec_mode: "fork",
      instances: 1,

      env: {
        NODE_ENV: "production",
        PORT: 3100,
        HOSTNAME: LOOPBACK,
        APP_NAME: "metnmat-website",

        // The heap cap travels as NODE_OPTIONS, NOT as pm2's `node_args`.
        // `node_args` is passed to the INTERPRETER, and the interpreter here is
        // /bin/bash (the script is the secrets wrapper, not a .js file). bash
        // received `--max-old-space-size=448`, rejected it as an invalid option,
        // and crash-looped the first deploy. NODE_OPTIONS is read by node
        // itself, so it survives being exec'd from inside the wrapper.
        NODE_OPTIONS: "--max-old-space-size=448",

        // What THIS app cannot start without, checked by with-secrets.sh before
        // node is exec'd. metnmat/prod/* is one pool shared with the CMS and the
        // WhatsApp worker, so the wrapper must not fail on a secret this app
        // never reads — an unpopulated chatbot token is not the website's
        // problem.
        //
        // INTERNAL_API_KEY only: it is what instrumentation.ts throws on at
        // startup. NEXT_PUBLIC_CMS_URL is the other thing it checks, but that is
        // inlined at BUILD time and cannot come from Secrets Manager at all.
        REQUIRED_SECRETS: "INTERNAL_API_KEY",
      },

      // The V8 heap cap lives in env.NODE_OPTIONS above — see the note there for
      // why `node_args` cannot be used with a shell interpreter. Its purpose is
      // unchanged: keep the heap below the PM2 restart threshold so a leak shows
      // up as GC pressure and then a clean restart, rather than as the kernel
      // OOM killer choosing a victim — which on this box WOULD be a real risk,
      // since the command-center dashboard shares it.

      // Restart if RSS exceeds this. Both numbers are sized against MEASURED
      // headroom, not the blueprint's: §12 recorded 834 MB available, the live
      // instance reports 654 MB and the dashboard process is documented as
      // "gradually growing". A threshold above available memory is worse than
      // none at all — the kernel OOM killer reaches the process first, and it
      // picks its own victim rather than the one at fault.
      //
      // This manages the symptom. It does not create capacity: a website needing
      // 400-600 MB against 654 MB available, shrinking, is not a configuration
      // problem. Sustained restarts here mean resize to t3.medium.
      max_memory_restart: "560M",

      // A crash loop should stop, not hammer the box that is also serving the
      // dashboard.
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 4000,
      autorestart: true,

      // Per-process logs, so one app's noise never buries another's.
      error_file: "/home/ec2-user/web/logs/website.error.log",
      out_file: "/home/ec2-user/web/logs/website.out.log",
      merge_logs: true,
      time: true,
    },

    // ── metnmat-cms ─────────────────────────────────────────────────────────
    // Enabled after the t3.medium resize. Measured immediately after it:
    // 3835 MB total, 2915 MB available, against a CMS wanting 500-800 MB. On the
    // previous t3.small (568 MB free) this could not have run, which is why it
    // stayed commented out until the instance changed.
    {
      name: "metnmat-cms",

      // NOT a server.js. Payload has no Next standalone output
      // (Dockerfile.dashboard:3), so unlike the website there is no
      // self-contained entrypoint — the CMS runs through the next CLI against a
      // full node_modules produced by `pnpm deploy`. Started via the secrets
      // wrapper for the same reason the website is.
      script: "/home/ec2-user/cms/bin/with-secrets.sh",
      interpreter: "/bin/bash",
      args: "node_modules/.bin/next start --port 3200 --hostname 127.0.0.1",
      cwd: "/home/ec2-user/cms/current",

      exec_mode: "fork",
      instances: 1,

      env: {
        NODE_ENV: "production",
        APP_NAME: "metnmat-cms",

        // Storage is CONFIGURATION, not a secret, so it lives here rather than
        // in Secrets Manager. No access key: omitting credentials is what makes
        // the AWS SDK use the instance role, which is the whole point of
        // granting it (deploy/aws/instance-role-policy.json).
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "metnmat-media-prod",
        S3_REGION: "ap-south-1",

        // Exactly what payload.config.ts assertProductionConfig() throws on. It
        // refuses to start without these, so failing here — before node is
        // exec'd — turns a crash loop into one clear message.
        REQUIRED_SECRETS: "MONGODB_URI PAYLOAD_SECRET PAYLOAD_PIN_PEPPER CMS_URL",

        // Via NODE_OPTIONS, not pm2's node_args: node_args goes to the
        // INTERPRETER, which here is bash, and bash rejects it. That mistake
        // crash-looped the website's first deploy.
        NODE_OPTIONS: "--max-old-space-size=1024",
      },

      // Sized to the post-resize measurement. Payload's admin build is heavier
      // than the storefront, and image uploads spike it further via sharp.
      max_memory_restart: "1400M",

      // Longer than the website's: Payload connects to MongoDB Atlas and runs
      // seed() inside onInit before it serves anything, so a healthy boot is
      // genuinely slower and a 30s floor would call it a crash.
      max_restarts: 10,
      min_uptime: "60s",
      restart_delay: 4000,
      autorestart: true,

      error_file: "/home/ec2-user/cms/logs/cms.error.log",
      out_file: "/home/ec2-user/cms/logs/cms.out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
