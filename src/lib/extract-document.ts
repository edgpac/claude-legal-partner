/**
 * Client-side document text extraction.
 * Uses pdfjs-dist for PDFs and mammoth for DOCX. Plain text passed through.
 */

export type ExtractedDoc = {
  text: string;
  pageCount: number;
  wordCount: number;
};

export async function extractDocument(file: File): Promise<ExtractedDoc> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".txt")) return extractTxt(file);
  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
}

async function extractTxt(file: File): Promise<ExtractedDoc> {
  const text = await file.text();
  return { text, pageCount: 1, wordCount: countWords(text) };
}

async function extractPdf(file: File): Promise<ExtractedDoc> {
  const pdfjs = await import("pdfjs-dist");
  // Use worker shim via dynamic import URL
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    pages.push(text);
  }
  const text = pages.join("\n\n");
  return { text, pageCount: doc.numPages, wordCount: countWords(text) };
}

async function extractDocx(file: File): Promise<ExtractedDoc> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  const text = result.value;
  return { text, pageCount: Math.max(1, Math.ceil(countWords(text) / 350)), wordCount: countWords(text) };
}

function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
