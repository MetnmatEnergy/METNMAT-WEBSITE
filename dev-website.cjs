// Dev launcher: ensures Next.js runs with the app dir as the working directory
// (the preview harness would otherwise use a different cwd, breaking dev).
const path = require("path");
const appDir = path.join(__dirname, "apps", "website");
process.chdir(appDir);
const nextBin = path.join(appDir, "node_modules", "next", "dist", "bin", "next");
process.argv = [process.argv[0], nextBin, "dev"];
require(nextBin);
