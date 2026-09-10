import assert from "node:assert/strict";
import test from "node:test";
import { ocrScale, paddleText } from "../src/lib/ocr/result.ts";

test("PaddleOCR conserva acentos, idiomas y orden; descarta detecciones poco fiables", () => {
  assert.equal(
    paddleText([
      { text: "  Información y dirección  ", score: 0.99 },
      { text: "ruido", score: 0.1 },
      { text: "English text", score: 0.98 },
      { text: "", score: 1 },
      { text: "invalid", score: NaN },
    ]),
    "Información y dirección\nEnglish text",
  );
  assert.equal(paddleText([]), "");
});

test("OCR amplía A4 y limita memoria para páginas gigantes", () => {
  assert.equal(ocrScale(595, 842), 3);
  for (const [w, h] of [
    [10000, 20000],
    [20000, 100],
    [3000, 3000],
  ]) {
    const scale = ocrScale(w, h);
    assert.ok(w * h * scale * scale <= 8_000_001);
    assert.ok(Math.max(w, h) * scale <= 3201);
  }
  assert.throws(() => ocrScale(0, 100));
  assert.throws(() => ocrScale(Infinity, 100));
});
