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
      },

      // Cap the V8 heap below the PM2 restart threshold so a leak surfaces as
      // GC pressure first and a clean restart second, rather than as the kernel
      // OOM killer choosing a victim — which on this box WOULD be a real risk:
      // measured 2026-08-12, the command-center dashboard shares this instance.
      node_args: "--max-old-space-size=448",

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
    // Deliberately commented out. The blueprint (§12) sequences the CMS AFTER
    // the website has been measured for a few days, because the memory
    // arithmetic does not fit both on a t3.small:
    //
    //   available 834 MB  vs  website 400–600 MB + CMS 500–800 MB
    //
    // Uncomment only after the instance has been resized to t3.medium, or after
    // measurement proves the headroom exists.
    //
    // ⚠ Before enabling, read deploy/README.md § "Environment variables that
    //   must never be set". Two variables mutate production data on every CMS
    //   boot, and PM2 restarts count as boots.
    //
    // {
    //   name: "metnmat-cms",
    //   script: "apps/dashboard/server.js",
    //   cwd: "/home/ec2-user/cms/current",
    //   exec_mode: "fork",
    //   instances: 1,
    //   env: { NODE_ENV: "production", PORT: 3200, HOSTNAME: LOOPBACK },
    //   node_args: "--max-old-space-size=768",
    //   max_memory_restart: "1000M",
    //   max_restarts: 10,
    //   min_uptime: "60s",
    //   error_file: "/home/ec2-user/cms/logs/cms.error.log",
    //   out_file: "/home/ec2-user/cms/logs/cms.out.log",
    //   merge_logs: true,
    //   time: true,
    // },
  ],
};
