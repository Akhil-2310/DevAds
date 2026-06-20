#!/usr/bin/env node
// `devads` launcher. Registers the tsx loader so the TypeScript CLI runs
// directly, then hands off to the entry point with the user's args intact.
import { register } from "tsx/esm/api";
import path from "node:path";
import { fileURLToPath } from "node:url";

register();
const dir = path.dirname(fileURLToPath(import.meta.url));
await import(path.join(dir, "..", "src", "index.ts"));
