// Dashboard DEV server launcher (next dev) with correct cwd. Mirrors
// start-dashboard.cjs but runs the dev server so source changes are live.
const path = require("path");
const appDir = path.join(__dirname, "apps", "dashboard");
process.chdir(appDir);
const nextBin = path.join(appDir, "node_modules", "next", "dist", "bin", "next");
process.argv = [process.argv[0], nextBin, "dev", "-p", "3001"];
require(nextBin);
