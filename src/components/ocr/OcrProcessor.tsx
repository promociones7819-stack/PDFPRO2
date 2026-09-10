import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  Download,
  Copy,
  FileSearch,
  Loader2,
  ShieldCheck,
  UploadCloud,
  ScanText,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPdfjs } from "@/lib/pdf/pdfjs";
import { saveBlob } from "@/lib/download";

import { createOcrWorker, type OcrWorker } from "@/lib/ocr/engine";
import { ocrScale, type OcrEngine, type OcrLanguage } from "@/lib/ocr/result";

const MAX_BYTES = 100 * 1024 * 1024;

async function createSearchablePdf(bytes: Uint8Array, pageTexts: string[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes.slice(0), {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const text = (pageTexts[index] ?? "")
      .replace(/[^\u0020-\u00ff\n]/g, "?")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, 30_000);
    if (!text) return;
    page.drawText(text, {
      x: 2,
      y: Math.max(2, page.getHeight() - 4),
      size: 1,
      lineHeight: 1.15,
      font,
      color: rgb(0, 0, 0),
      opacity: 0,
      maxWidth: Math.max(1, page.getWidth() - 4),
    });
  });
  return doc.save({ useObjectStreams: true });
}

export function OcrProcessor({
  initialFile,
  onPdfCreated,
}: {
  initialFile?: File | null;
  onPdfCreated?: (file: File) => Promise<void> | void;
} = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<OcrLanguage>("spa");
  const [engine, setEngine] = useState<OcrEngine>("paddle");
  const runningRef = useRef(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const cancelledRef = useRef(false);
  const initialRef = useRef<File | null>(null);

  async function processPdf(file: File | undefined) {
    if (!file || runningRef.current) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      toast.error("Solo se admiten archivos PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("El archivo supera los 100 MB.");
      return;
    }

    runningRef.current = true;
    setBusy(true);
    setProgress(0);
    setText("");
    setPageTexts([]);
    setSourceBytes(null);
    setFileName(file.name);
    setStatus("Leyendo el archivo PDF…");

    let worker: OcrWorker | null = null;
    let pdf: PDFDocumentProxy | undefined;
    cancelledRef.current = false;

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setSourceBytes(bytes);
      const pdfjs = await getPdfjs();
      pdf = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
      const numPages = pdf.numPages;

      setStatus("Inicializando el motor OCR (primera vez puede tardar)…");
      worker = await createOcrWorker(engine, language);

      const parts: string[] = [];
      for (let i = 1; i <= numPages; i++) {
        if (cancelledRef.current) break;
        setStatus(`Procesando página ${i} de ${numPages}…`);
        const page = await pdf.getPage(i);
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: ocrScale(original.width, original.height) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas-2d-unavailable");
        try {
          await page.render({
            canvas,
            canvasContext: ctx,
            viewport,
          } as Parameters<typeof page.render>[0]).promise;

          const { data } = await worker!.recognize(canvas);
          parts.push(`--- Página ${i} ---\n${(data.text ?? "").trim()}`);
          setText(parts.join("\n\n"));
          setPageTexts(parts.map((part) => part.replace(/^--- Página \d+ ---\n/, "")));
          setProgress(Math.round((i / numPages) * 100));
        } finally {
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
        }
      }

      setPageTexts(parts.map((part) => part.replace(/^--- Página \d+ ---\n/, "")));
      if (cancelledRef.current) {
        setStatus("OCR cancelado. Puedes conservar el texto ya reconocido.");
        return;
      }

      setStatus(`OCR completado: ${numPages} página(s).`);
      toast.success("Texto extraído con OCR");
    } catch (error) {
      if (!cancelledRef.current) {
        console.error(error);
        setStatus(
          "El reconocimiento no se ha completado. Puedes conservar el texto extraído y volver a intentarlo.",
        );
        toast.error(
          engine === "paddle"
            ? "PaddleOCR no pudo completar el reconocimiento. Comprueba la conexión para descargar los modelos o prueba Tesseract."
            : "No se ha podido procesar el PDF con OCR.",
        );
      }
    } finally {
      await worker?.terminate().catch(() => undefined);
      await pdf?.destroy().catch(() => undefined);
      runningRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!initialFile || initialRef.current === initialFile) return;
    initialRef.current = initialFile;
    void processPdf(initialFile);
    // El fichero inicial solo se procesa una vez por identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  async function downloadTxt() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const name = (fileName ?? "documento.pdf").replace(/\.pdf$/i, "") + "-ocr.txt";
    await saveBlob(blob, name);
  }

  async function downloadSearchablePdf() {
    if (!sourceBytes || !pageTexts.length) return;
    try {
      const bytes = await createSearchablePdf(sourceBytes, pageTexts);
      const name = (fileName ?? "documento.pdf").replace(/\.pdf$/i, "") + "-ocr-buscable.pdf";
      const file = new File([bytes.slice(0) as unknown as BlobPart], name, {
        type: "application/pdf",
      });
      if (onPdfCreated) {
        await onPdfCreated(file);
        toast.success("PDF buscable abierto en el editor");
      } else {
        await saveBlob(file, name);
        toast.success("PDF buscable guardado");
      }
    } catch (error) {
      console.error("[ocr] PDF buscable", error);
      toast.error("No se ha podido crear el PDF buscable.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">OCR local de PDF</h2>
          <p className="text-sm text-muted-foreground">
            Reconoce texto de PDFs escaneados. El archivo se procesa en tu navegador; la primera vez
            puede necesitar Internet para descargar el motor y el idioma.
          </p>
        </div>
        <div className="w-56 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Motor de reconocimiento
          </label>
          <Select value={engine} onValueChange={(v) => setEngine(v as OcrEngine)} disabled={busy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paddle">PaddleOCR · Multilingüe</SelectItem>
              <SelectItem value="tesseract">Tesseract · Alternativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Idioma</label>
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as OcrLanguage)}
            disabled={busy}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spa">Español</SelectItem>
              <SelectItem value="eng">Inglés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void processPdf(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        <span className="mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ScanText className="size-5" />}
        </span>
        <p className="text-sm font-medium">Arrastra un PDF aquí</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {fileName ?? "o selecciónalo desde tu dispositivo"}
        </p>
        <Button
          className="mt-4"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud className="mr-2 size-4" /> Seleccionar PDF
        </Button>
        {busy && (
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onClick={() => {
              cancelledRef.current = true;
              setStatus("Cancelando al finalizar la página actual…");
            }}
          >
            <X className="mr-2 size-4" /> Cancelar
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void processPdf(file);
          }}
        />
      </div>

      {(busy || status) && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{status || `${progress}%`}</p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Texto reconocido (editable)
        </label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder="El texto extraído aparecerá aquí…"
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!text}
            onClick={() => {
              void navigator.clipboard
                .writeText(text)
                .then(() => toast.success("Texto copiado"))
                .catch(() => toast.error("No se ha podido copiar"));
            }}
          >
            <Copy className="mr-2 size-4" /> Copiar
          </Button>
          <Button size="sm" disabled={!text} onClick={downloadTxt}>
            <Download className="mr-2 size-4" /> Descargar .txt
          </Button>
          <Button
            size="sm"
            disabled={busy || !pageTexts.length || !sourceBytes}
            onClick={() => void downloadSearchablePdf()}
          >
            <FileSearch className="mr-2 size-4" /> Crear PDF buscable
          </Button>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" /> Procesamiento privado: tu PDF nunca se sube
        a un servidor.
      </p>
    </section>
  );
}
