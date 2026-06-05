// Dashboard production server launcher (serves the .next build) with correct cwd.
const path = require("path");
const appDir = path.join(__dirname, "apps", "dashboard");
process.chdir(appDir);
const nextBin = path.join(appDir, "node_modules", "next", "dist", "bin", "next");
process.argv = [process.argv[0], nextBin, "start", "-p", "3001"];
require(nextBin);
