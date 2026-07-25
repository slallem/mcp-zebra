/** GTIN lengths recognised by GS1 (GTIN-8, UPC-A/GTIN-12, EAN-13/GTIN-13, GTIN-14). */
export const VALID_GTIN_LENGTHS = [8, 12, 13, 14] as const;
export type GtinLength = (typeof VALID_GTIN_LENGTHS)[number];

export interface GtinValidationResult {
  input: string;
  normalized: string | null;
  length: number | null;
  isValidLength: boolean;
  computedCheckDigit: number | null;
  providedCheckDigit: number | null;
  valid: boolean;
  reason?: string;
}

/**
 * Computes the GS1 check digit for a GTIN payload (the digits excluding the
 * check digit itself). Works uniformly for GTIN-8/12/13/14 because the
 * weighting (3,1,3,1,...) is applied from the rightmost digit regardless of
 * overall length.
 */
export function computeGtinCheckDigit(payloadDigits: string): number {
  const digits = payloadDigits.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const positionFromRight = digits.length - i;
    const weight = positionFromRight % 2 === 1 ? 3 : 1;
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function validateGtin(rawInput: string): GtinValidationResult {
  const input = rawInput;
  const normalized = rawInput.trim().replace(/[\s-]/g, "");

  if (!/^\d+$/.test(normalized)) {
    return {
      input,
      normalized: null,
      length: null,
      isValidLength: false,
      computedCheckDigit: null,
      providedCheckDigit: null,
      valid: false,
      reason: "Input must contain only digits (spaces and hyphens are stripped automatically).",
    };
  }

  const length = normalized.length;
  const isValidLength = (VALID_GTIN_LENGTHS as readonly number[]).includes(length);
  if (!isValidLength) {
    return {
      input,
      normalized,
      length,
      isValidLength,
      computedCheckDigit: null,
      providedCheckDigit: null,
      valid: false,
      reason: `Length ${length} is not a valid GTIN length. Expected one of: ${VALID_GTIN_LENGTHS.join(", ")}.`,
    };
  }

  const payload = normalized.slice(0, -1);
  const providedCheckDigit = Number(normalized.slice(-1));
  const computedCheckDigit = computeGtinCheckDigit(payload);
  const valid = computedCheckDigit === providedCheckDigit;

  return {
    input,
    normalized,
    length,
    isValidLength,
    computedCheckDigit,
    providedCheckDigit,
    valid,
    reason: valid
      ? undefined
      : `Check digit mismatch: expected ${computedCheckDigit}, found ${providedCheckDigit}.`,
  };
}

export interface GenerateGtinOptions {
  length?: GtinLength;
  prefix?: string;
}

export interface GeneratedGtin {
  gtin: string;
  length: GtinLength;
  prefix: string;
  checkDigit: number;
}

export function generateGtin(options: GenerateGtinOptions = {}): GeneratedGtin {
  const length = options.length ?? 13;
  if (!(VALID_GTIN_LENGTHS as readonly number[]).includes(length)) {
    throw new Error(`length must be one of: ${VALID_GTIN_LENGTHS.join(", ")}`);
  }

  const prefix = (options.prefix ?? "").trim();
  if (prefix && !/^\d+$/.test(prefix)) {
    throw new Error("prefix must contain only digits");
  }
  if (prefix.length > length - 1) {
    throw new Error(`prefix is too long for a GTIN-${length} (max ${length - 1} digits)`);
  }

  const randomDigitsCount = length - 1 - prefix.length;
  let randomDigits = "";
  for (let i = 0; i < randomDigitsCount; i++) {
    randomDigits += Math.floor(Math.random() * 10).toString();
  }

  const payload = prefix + randomDigits;
  const checkDigit = computeGtinCheckDigit(payload);
  const gtin = payload + checkDigit.toString();

  return { gtin, length: length as GtinLength, prefix, checkDigit };
}
