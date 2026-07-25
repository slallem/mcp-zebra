import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { VALID_GTIN_LENGTHS, generateGtin, validateGtin } from "./tools/gtin.js";
import {
  SUPPORTED_BARCODE_TYPES,
  generateBarcodeImage,
} from "./tools/generateBarcode.js";
import { decodeBarcodeImage } from "./tools/decodeBarcode.js";

const SERVER_NAME = "mcp-zebra";
const SERVER_VERSION = "0.1.0";

/**
 * Builds a fresh McpServer with all barcode tools registered. A new instance
 * is created per request (see src/lambda.ts and src/local.ts) rather than
 * reused across invocations, matching the SDK's documented stateless HTTP
 * pattern and avoiding cross-request state leaking between transports.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "validate_gtin",
    {
      title: "Validate GTIN",
      description:
        "Validates a GTIN/EAN/UPC barcode number (lengths 8, 12, 13 or 14) by recomputing its GS1 check digit " +
        "and comparing it to the supplied one. Spaces and hyphens in the input are ignored.",
      inputSchema: z.object({
        code: z
          .string()
          .min(1)
          .describe("The barcode number to validate, e.g. '4006381333931'."),
      }),
    },
    async ({ code }) => {
      const result = validateGtin(code);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.valid,
      };
    }
  );

  server.registerTool(
    "generate_gtin",
    {
      title: "Generate a random valid GTIN",
      description:
        "Generates a random, check-digit-valid GTIN of the requested length (8, 12, 13 or 14 digits). " +
        "An optional numeric prefix (e.g. a GS1 company prefix) can be supplied; the remaining digits are " +
        "randomised and a correct check digit is appended.",
      inputSchema: z.object({
        length: z
          .union([z.literal(8), z.literal(12), z.literal(13), z.literal(14)])
          .default(13)
          .describe(`GTIN length to generate. One of: ${VALID_GTIN_LENGTHS.join(", ")}.`),
        prefix: z
          .string()
          .regex(/^\d*$/, "prefix must contain only digits")
          .optional()
          .describe("Optional leading digits to keep fixed (e.g. a GS1 company prefix)."),
      }),
    },
    async ({ length, prefix }) => {
      const result = generateGtin({ length, prefix });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "generate_barcode_image",
    {
      title: "Generate a barcode image",
      description:
        "Renders a barcode image (PNG) for the given code and symbology. Supports common 1D retail symbologies " +
        `(GTIN/EAN/UPC family, Code128, Code39, ITF-14) and 2D symbologies (QR Code, Data Matrix, PDF417, ` +
        `Aztec). Supported barcodeType values: ${SUPPORTED_BARCODE_TYPES.join(", ")}.`,
      inputSchema: z.object({
        code: z.string().min(1).describe("The value to encode, e.g. a GTIN or arbitrary text for QR/Data Matrix."),
        barcodeType: z
          .enum(SUPPORTED_BARCODE_TYPES)
          .describe("The barcode symbology to render."),
        scale: z.number().int().min(1).max(20).optional().describe("Pixel size of a single barcode module (default 5)."),
        includeText: z.boolean().optional().describe("Whether to print human-readable text under the barcode (default true)."),
      }),
    },
    async ({ code, barcodeType, scale, includeText }) => {
      try {
        const { pngBase64, width, height: pixelHeight } = await generateBarcodeImage({
          code,
          barcodeType,
          scale,
          includeText,
        });
        return {
          content: [
            {
              type: "text",
              text: `Generated ${barcodeType} barcode for "${code}" (${width}x${pixelHeight}px).`,
            },
            { type: "image", data: pngBase64, mimeType: "image/png" },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to generate barcode: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "decode_barcode_image",
    {
      title: "Decode a barcode from an image",
      description:
        "Decodes a barcode (1D or 2D) found in a supplied image. Provide the image as base64-encoded PNG/JPEG/BMP " +
        "data, optionally prefixed with a data: URL header. Optionally restrict the search to specific formats.",
      inputSchema: z.object({
        imageBase64: z
          .string()
          .min(1)
          .describe("Base64-encoded image bytes, optionally as a data: URL (e.g. 'data:image/png;base64,...')."),
        formats: z
          .array(z.string())
          .optional()
          .describe(
            "Optional list of barcode format names to restrict decoding to (e.g. ['EAN13', 'QRCode']). " +
              "Defaults to trying all supported formats."
          ),
      }),
    },
    async ({ imageBase64, formats }) => {
      try {
        const result = await decodeBarcodeImage({ imageBase64, formats });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to decode barcode: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
