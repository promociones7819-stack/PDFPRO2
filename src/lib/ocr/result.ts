export type OcrEngine = "paddle" | "tesseract";
export type OcrLanguage = "spa" | "eng";

/** Preserve the reading order produced by PaddleOCR; do not reorder columns by y. */
export function paddleText(items: ReadonlyArray<{ text: string; score: number }>): string {
  return items
    .filter((item) => Number.isFinite(item.score) && item.score >= 0.35)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n");
}

/** Bound memory even for oversized architectural or poster PDF pages. */
export function ocrScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Dimensiones de página inválidas.");
  }
  return Math.min(3, 3200 / Math.max(width, height), Math.sqrt(8_000_000 / (width * height)));
}
