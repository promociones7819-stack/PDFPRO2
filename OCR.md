# OCR con PaddleOCR

PDFPRO2 utiliza el SDK oficial [`@paddleocr/paddleocr-js`](https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js), versión 0.4.2 (Apache-2.0).

- Motor predeterminado: PP-OCRv6 small, detección y reconocimiento multilingüe.
- Se utiliza en la herramienta OCR y en páginas escaneadas de documentos del asistente de IA.
- Tesseract sigue disponible en el selector de la herramienta OCR.
- Los documentos se procesan en el navegador, en un Web Worker. No se envían a un servicio OCR.
- Los modelos se descargan de los servidores oficiales de PaddleOCR. El runtime WASM se descarga de jsDelivr con versión 1.24.3, coincidente con la incluida en el worker del SDK.
- La primera ejecución requiere conexión y puede tardar mientras descarga los recursos. No se garantiza funcionamiento sin conexión.
- Se usa WASM con un hilo para funcionar en el sitio estático de Cloudflare sin exigir aislamiento COOP/COEP.
- Las páginas se renderizan hasta escala 3, con límites de 3200 píxeles por lado y 8 millones de píxeles para contener el consumo de memoria.
- Se conserva el orden de lectura del motor y se descartan líneas con confianza inferior a 0,35.
- Cancelar detiene el proceso después de la página en curso y conserva el texto reconocido.

## Verificación

`npm test`, `npx tsc --noEmit` y `npm run build`.

Se ha comprobado en Chrome el reconocimiento de una imagen sintética en español e inglés, con acentos e importes. Esto verifica la integración, no constituye una comparativa de precisión en documentos reales. La calidad depende del escaneado, tamaño del texto y distribución de la página.

El PDF buscable conserva el mecanismo existente de texto invisible; no reconstruye todavía la posición exacta de cada palabra ni tablas editables. Los cambios manuales en el área de texto se aplican a la exportación TXT, mientras que el PDF utiliza los resultados originales del reconocimiento.
