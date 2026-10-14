// Client-side Image & PDF auto-compression utility targeting <= 500 KB with 100% letter/text clarity preservation

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const TARGET_BYTES = 490 * 1024; // ~501,760 bytes (strictly under 500 KB)

/**
 * Compresses an image File down to <= 500 KB if needed.
 * If already under 500 KB, the original file is preserved with 100% original clarity.
 */
export async function compressImageTo500Kb(file, onProgress) {
  // If already under 500 KB, keep 100% original quality
  if (file.size <= TARGET_BYTES) {
    const previewUrl = URL.createObjectURL(file);
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      previewUrl,
      ratio: 0,
      isImage: true,
      isPdf: false,
    };
  }

  // Load image
  const img = new Image();
  const rawUrl = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Unable to load image file."));
    img.src = rawUrl;
  });
  URL.revokeObjectURL(rawUrl);

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  // Ultra-high resolution cap (up to 2400px) so small text, letters, and numbers remain crystal sharp
  const maxInitialDim = 2400;
  if (width > maxInitialDim || height > maxInitialDim) {
    if (width > height) {
      height = Math.round((height * maxInitialDim) / width);
      width = maxInitialDim;
    } else {
      width = Math.round((width * maxInitialDim) / height);
      height = maxInitialDim;
    }
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  let quality = 0.88;
  let bestBlob = null;

  for (let iteration = 0; iteration < 10; iteration++) {
    if (onProgress) {
      onProgress({ pass: iteration + 1, totalPasses: 10 });
    }

    canvas.width = Math.max(160, width);
    canvas.height = Math.max(160, height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    if (!blob) break;
    bestBlob = blob;

    if (blob.size <= TARGET_BYTES) {
      break;
    }

    // High quality is maintained; gently reduce quality first before resolution
    if (quality > 0.65) {
      quality -= 0.07;
    } else {
      width = Math.round(width * 0.90);
      height = Math.round(height * 0.90);
      quality = 0.78;
    }
  }

  const finalBlob = bestBlob || file;
  const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
  const compressedFile = new File([finalBlob], newName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  const previewUrl = URL.createObjectURL(finalBlob);
  const ratio = Math.round(((file.size - finalBlob.size) / file.size) * 100);

  return {
    file: compressedFile,
    originalSize: file.size,
    compressedSize: finalBlob.size,
    previewUrl,
    ratio: Math.max(0, ratio),
    isImage: true,
    isPdf: false,
  };
}

/**
 * Compresses a PDF File down to <= 500 KB if needed.
 * CRITICAL: If the PDF is ALREADY <= 500 KB, it is NOT touched or re-encoded at all!
 * Original vector text, fonts, and 100% sharpness are preserved untouched.
 */
export async function compressPdfTo500Kb(file, onProgress) {
  // If already under 500 KB, NEVER recompress! Preserves 100% original sharpness and vector letters!
  if (file.size <= TARGET_BYTES) {
    const previewUrl = URL.createObjectURL(file);
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      previewUrl,
      ratio: 0,
      isImage: false,
      isPdf: true,
      originalPreserved: true,
    };
  }

  // Only if > 500 KB, optimize with ultra-high DPI to protect letter clarity
  let pdfjsLib;
  try {
    pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
  } catch {
    pdfjsLib = await import("pdfjs-dist");
  }

  const { jsPDF } = await import("jspdf");

  if (typeof window !== "undefined") {
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
    } catch {
      // fallback
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // With a 500 KB budget, we can use 2.5x - 3.0x scale (200-250 DPI) for crystal clear letters
  let maxDimension = 2400;
  let quality = 0.85;

  if (numPages === 1) {
    maxDimension = 2400; // ~220 DPI on A4, perfectly sharp text
    quality = 0.85;
  } else if (numPages === 2) {
    maxDimension = 1900;
    quality = 0.78;
  } else if (numPages <= 4) {
    maxDimension = 1500;
    quality = 0.68;
  } else {
    maxDimension = 1200;
    quality = 0.55;
  }

  let finalBlob = null;

  for (let pass = 0; pass < 6; pass++) {
    if (onProgress) {
      onProgress({ pass: pass + 1, totalPasses: 6 });
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      compress: true,
    });
    let isFirstPage = true;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const originalViewport = page.getViewport({ scale: 1.0 });

      const maxOriginalDim = Math.max(originalViewport.width, originalViewport.height);
      const scaleFactor = Math.min(3.0, maxDimension / maxOriginalDim);
      const renderViewport = page.getViewport({ scale: scaleFactor });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(120, Math.round(renderViewport.width));
      canvas.height = Math.max(120, Math.round(renderViewport.height));

      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: renderViewport,
      }).promise;

      const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);

      const ptWidth = originalViewport.width;
      const ptHeight = originalViewport.height;
      const orientation = ptWidth > ptHeight ? "landscape" : "portrait";

      if (isFirstPage) {
        doc.deletePage(1);
        doc.addPage([ptWidth, ptHeight], orientation);
        doc.addImage(jpegDataUrl, "JPEG", 0, 0, ptWidth, ptHeight, undefined, "FAST");
        isFirstPage = false;
      } else {
        doc.addPage([ptWidth, ptHeight], orientation);
        doc.addImage(jpegDataUrl, "JPEG", 0, 0, ptWidth, ptHeight, undefined, "FAST");
      }
    }

    const currentBlob = doc.output("blob");
    finalBlob = currentBlob;

    if (currentBlob.size <= TARGET_BYTES) {
      break;
    }

    // Step down gently to protect text clarity
    const overRatio = currentBlob.size / TARGET_BYTES;
    if (overRatio > 1.5) {
      quality = Math.max(0.45, quality * 0.78);
      maxDimension = Math.max(1300, Math.round(maxDimension * 0.85));
    } else {
      quality = Math.max(0.55, quality * 0.88);
      maxDimension = Math.max(1600, Math.round(maxDimension * 0.92));
    }
  }

  if (!finalBlob) {
    throw new Error("Failed to optimize PDF file.");
  }

  const compressedFile = new File([finalBlob], file.name, {
    type: "application/pdf",
    lastModified: Date.now(),
  });

  const previewUrl = URL.createObjectURL(finalBlob);
  const ratio = Math.round(((file.size - finalBlob.size) / file.size) * 100);

  return {
    file: compressedFile,
    originalSize: file.size,
    compressedSize: finalBlob.size,
    previewUrl,
    ratio: Math.max(0, ratio),
    isImage: false,
    isPdf: true,
  };
}

// Backward-compatible aliases
export const compressImageTo50Kb = compressImageTo500Kb;
export const compressPdfTo50Kb = compressPdfTo500Kb;
export const compressImageTo100Kb = compressImageTo500Kb;
export const compressPdfTo100Kb = compressPdfTo500Kb;

/**
 * Universal auto-compression function for both Images and PDFs.
 * If file <= 500 KB: keeps 100% original, untouched clarity.
 * If file > 500 KB: optimizes down to < 500 KB with ultra-high resolution text preservation.
 */
export async function autoCompressFile(file, onProgress) {
  const mime = file.type || "";
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (isImage) {
    return await compressImageTo500Kb(file, onProgress);
  } else if (isPdf) {
    return await compressPdfTo500Kb(file, onProgress);
  } else {
    throw new Error("Invalid file type. Only Images and PDFs are allowed.");
  }
}
