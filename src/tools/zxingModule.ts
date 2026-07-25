import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prepareZXingModule } from "zxing-wasm/full";

/**
 * Locates the zxing-cpp WASM binary and wires it up for `readBarcodes` /
 * `writeBarcode` so nothing is fetched over the network at runtime.
 *
 * Two run modes need two different strategies:
 * - Lambda (esbuild CJS bundle): the build step copies zxing_full.wasm next
 *   to the bundled index.js, so `__dirname` (native in CJS) finds it.
 * - Local dev (tsx, real ESM, unbundled): resolve straight from
 *   node_modules via `createRequire`, since there's no copied file yet.
 */
function resolveWasmBinary(): ArrayBuffer {
  let wasmPath: string;
  if (typeof require !== "undefined") {
    wasmPath = path.join(__dirname, "zxing_full.wasm");
  } else {
    const requireFromHere = createRequire(import.meta.url);
    const pkgPath = requireFromHere.resolve("zxing-wasm/package.json");
    wasmPath = path.join(path.dirname(pkgPath), "dist", "full", "zxing_full.wasm");
  }
  const buffer = readFileSync(wasmPath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

let prepared = false;

export function ensureZXingModulePrepared(): void {
  if (prepared) return;
  prepared = true;
  prepareZXingModule({
    overrides: {
      wasmBinary: resolveWasmBinary(),
    },
  });
}
