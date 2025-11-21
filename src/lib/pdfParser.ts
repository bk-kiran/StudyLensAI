import * as pdfjsLib from "pdfjs-dist";

// Initialize worker only on client side
if (typeof window !== "undefined") {
  // Use local worker file from public directory (most reliable)
  // Falls back to CDN if local file is not available
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(" ") + "\n\n";
  }
  return text;
}
