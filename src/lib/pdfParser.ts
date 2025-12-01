import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, TextItem } from "pdfjs-dist/types/src/display/api";

// Initialize worker only on client side
if (typeof window !== "undefined") {
  // Use local worker file from public directory (most reliable)
  // Falls back to CDN if local file is not available
  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
}

interface TextContent {
  items: Array<TextItem | { str: string }>;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf: PDFDocumentProxy = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent() as unknown as TextContent;
    text += content.items.map((item) => {
      if ('str' in item) {
        return item.str;
      }
      return '';
    }).join(" ") + "\n\n";
  }
  return text;
}
