import { writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/lambda.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  minify: false,
  logLevel: "info",
  // zxingModule.ts guards its `import.meta.url` branch behind `typeof
  // require === "undefined"`, which is always false in this CJS bundle, so
  // that branch is dead code here — esbuild still flags the bare reference.
  logOverride: { "empty-import-meta": "silent" },
});

// zxingModule.ts loads the WASM binary from disk relative to __dirname at
// runtime (see that file for why), so it must sit next to the bundled
// index.js in the deployed Lambda zip.
copyFileSync("node_modules/zxing-wasm/dist/full/zxing_full.wasm", "dist/zxing_full.wasm");

// The repo root package.json declares "type": "module" (source is ESM), but
// esbuild emits CommonJS for the Lambda bundle. Without a local override,
// Node resolves module type from the nearest package.json, which would make
// it misinterpret dist/index.js. This keeps `node dist/index.js` and any
// local tooling correct; the deployed zip only ships index.js anyway, so
// Lambda's own CommonJS default applies regardless.
writeFileSync("dist/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
