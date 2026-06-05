import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve the Tailwind config absolutely so it loads regardless of the
// process working directory (our dev launcher runs from a different cwd).
const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: { config: path.join(dir, "tailwind.config.ts") },
    autoprefixer: {},
  },
};

export default config;
