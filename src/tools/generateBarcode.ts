import { writeBarcode } from "zxing-wasm/full";
import { ensureZXingModulePrepared } from "./zxingModule.js";

/**
 * User-facing barcode type names, mapped to zxing-cpp's canonical format
 * names (see https://github.com/zxing-cpp/zxing-cpp for the full catalogue).
 */
const BARCODE_TYPE_TO_ZXING_FORMAT = {
  code128: "Code128",
  code39: "Code39",
  ean13: "EAN13",
  ean8: "EAN8",
  upca: "UPCA",
  upce: "UPCE",
  itf14: "ITF14",
  qrcode: "QRCode",
  datamatrix: "DataMatrix",
  pdf417: "PDF417",
  azteccode: "Aztec",
} as const;

export const SUPPORTED_BARCODE_TYPES = Object.keys(BARCODE_TYPE_TO_ZXING_FORMAT) as [
  keyof typeof BARCODE_TYPE_TO_ZXING_FORMAT,
  ...(keyof typeof BARCODE_TYPE_TO_ZXING_FORMAT)[],
];

export type SupportedBarcodeType = (typeof SUPPORTED_BARCODE_TYPES)[number];

export interface GenerateBarcodeOptions {
  code: string;
  barcodeType: SupportedBarcodeType;
  /** Pixel size of a single barcode module (default 5). */
  scale?: number;
  includeText?: boolean;
}

export interface GenerateBarcodeResult {
  pngBase64: string;
  width: number;
  height: number;
}

export async function generateBarcodeImage(
  options: GenerateBarcodeOptions
): Promise<GenerateBarcodeResult> {
  ensureZXingModulePrepared();

  const { code, barcodeType, scale = 5, includeText = true } = options;
  const format = BARCODE_TYPE_TO_ZXING_FORMAT[barcodeType];

  const result = await writeBarcode(code, {
    format,
    scale,
    addHRT: includeText,
    addQuietZones: true,
  });

  if (!result.image) {
    throw new Error(result.error || `Failed to render a ${barcodeType} barcode for "${code}".`);
  }

  const pngBuffer = Buffer.from(await result.image.arrayBuffer());
  return {
    pngBase64: pngBuffer.toString("base64"),
    // Read straight from the PNG IHDR chunk: result.symbol is the raw module
    // grid, not the final rendered pixel size (which also includes quiet
    // zones and human-readable text).
    width: pngBuffer.readUInt32BE(16),
    height: pngBuffer.readUInt32BE(20),
  };
}
