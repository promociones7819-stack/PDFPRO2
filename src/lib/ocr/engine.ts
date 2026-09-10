import { paddleText } from "./result";
import type { OcrEngine, OcrLanguage } from "./result";

export interface OcrWorker {
  recognize(image: HTMLCanvasElement): Promise<{ data: { text: string } }>;
  terminate(): Promise<void>;
}

export async function createOcrWorker(
  engine: OcrEngine = "paddle",
  language: OcrLanguage = "spa",
): Promise<OcrWorker> {
  if (engine === "tesseract") {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(language);
    return {
      recognize: (image) => worker.recognize(image, { rotateAuto: true }),
      terminate: async () => {
        await worker.terminate();
      },
    };
  }

  const { PaddleOCR } = await import("@paddleocr/paddleocr-js");
  const pipeline = await PaddleOCR.create({
    lang: language === "spa" ? "es" : "en",
    ocrVersion: "PP-OCRv6",
    worker: true,
    initialize: false,
    ortOptions: {
      backend: "wasm",
      // The SDK 0.4.2 worker embeds ORT 1.24.3 (independent of the app's ORT).
      wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/",
      numThreads: 1,
    },
  });
  let disposed = false;
  return {
    async recognize(image) {
      if (disposed) throw new Error("El motor OCR se ha cerrado.");
      const [result] = await pipeline.predict(image, {
        textDetLimitSideLen: 1600,
        textDetLimitType: "max",
        textRecScoreThresh: 0.35,
      });
      if (!result) throw new Error("PaddleOCR no devolvió un resultado.");
      return { data: { text: paddleText(result.items) } };
    },
    async terminate() {
      if (disposed) return;
      disposed = true;
      await pipeline.dispose();
    },
  };
}
