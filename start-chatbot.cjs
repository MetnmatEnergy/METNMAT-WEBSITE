// Launch wrapper for the Metnmat customer-agent chatbot (separate service).
// Runs it on port 3002 so it doesn't collide with the dashboard (3001), and
// points PUBLIC_URL at 3002 so widget.js serves the correct iframe/API origin.
// Used by .claude/launch.json -> "metnmat-chatbot" so the preview can reach it.
const { spawn } = require("node:child_process");

const cwd = "C:\\Users\\ritik\\OneDrive\\Desktop\\Metnmat-customer-agent-main";

const child = spawn("bun", ["run", "index.ts"], {
  cwd,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PORT: "3002",
    PUBLIC_URL: "http://localhost:3002",
    ALLOWED_ORIGINS: "*",
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
