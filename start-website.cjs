// Production server launcher (serves the .next build) with correct cwd.
const path = require("path");
const appDir = path.join(__dirname, "apps", "website");
process.chdir(appDir);
const nextBin = path.join(appDir, "node_modules", "next", "dist", "bin", "next");
process.argv = [process.argv[0], nextBin, "start"];
require(nextBin);
