import { readBarcodes, type ReaderOptions } from "zxing-wasm/full";
import { ensureZXingModulePrepared } from "./zxingModule.js";

export interface DecodeBarcodeOptions {
  /** Raw base64 image data (PNG/JPEG/BMP/etc), with or without a data: URL prefix. */
  imageBase64: string;
  /** Optional zxing-cpp format names to restrict decoding to (e.g. ["EAN13", "QRCode"]). */
  formats?: string[];
}

export interface DecodeBarcodeResult {
  text: string;
  format: string;
}

function stripDataUrlPrefix(input: string): string {
  const match = input.match(/^data:[^;]+;base64,(.*)$/s);
  return match ? match[1] : input;
}

export async function decodeBarcodeImage(
  options: DecodeBarcodeOptions
): Promise<DecodeBarcodeResult> {
  ensureZXingModulePrepared();

  const base64 = stripDataUrlPrefix(options.imageBase64.trim());
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error("imageBase64 did not decode to any image bytes");
  }

  const readerOptions: ReaderOptions = {
    tryHarder: true,
    maxNumberOfSymbols: 1,
  };
  if (options.formats && options.formats.length > 0) {
    readerOptions.formats = options.formats as ReaderOptions["formats"];
  }

  const results = await readBarcodes(new Uint8Array(buffer), readerOptions);

  const [result] = results.filter((r) => r.isValid);
  if (!result) {
    throw new Error("No barcode could be found in the supplied image.");
  }

  return { text: result.text, format: result.format };
}
