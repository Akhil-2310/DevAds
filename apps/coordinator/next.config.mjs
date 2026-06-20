import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@devads/shared"],
  // Pin the workspace root (the monorepo) so Turbopack doesn't pick a stray
  // lockfile in the home directory.
  turbopack: { root: path.join(__dirname, "..", "..") },
};

export default nextConfig;
