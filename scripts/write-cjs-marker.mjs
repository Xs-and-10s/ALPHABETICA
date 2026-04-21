// Writes the dist/cjs/package.json marker telling Node to interpret
// files in that directory as CommonJS, overriding the outer "type":"module".
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("dist/cjs", { recursive: true });
writeFileSync("dist/cjs/package.json", JSON.stringify({ type: "commonjs" }) + "\n");
