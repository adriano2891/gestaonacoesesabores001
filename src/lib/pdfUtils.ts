/**
 * Convert PDF or Image File to base64 Data URLs.
 * If the file is an image, converts directly.
 * If the file is a PDF, renders its pages to images using PDF.js CDN if loaded,
 * or handles file reading safely.
 */

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// Dynamically load PDF.js from CDN if converting PDF
let pdfjsLibLoaded = false;

async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfjsLibLoaded = true;
        resolve(pdfjs);
      } else {
        reject(new Error('PDF.js failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js script'));
    document.head.appendChild(script);
  });
}

export async function convertPdfToImageBase64s(file: File): Promise<string[]> {
  try {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const base64Images: string[] = [];

    const maxPages = Math.min(pdf.numPages, 10); // cap at 10 pages for safety

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      const base64Data = canvas.toDataURL('image/png');
      base64Images.push(base64Data);
    }

    return base64Images.length > 0 ? base64Images : [await fileToBase64(file)];
  } catch (error) {
    console.warn('PDF.js rendering fallback to raw file:', error);
    const rawBase64 = await fileToBase64(file);
    return [rawBase64];
  }
}
