// Client-side Image compression utility targeting <= 50 KB

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Compresses an image File down to <= 50 KB (50,000 bytes).
 * Iteratively adjusts quality and canvas dimensions.
 * Returns { file: File, originalSize: number, compressedSize: number, previewUrl: string }
 */
export async function compressImageTo50Kb(file) {
  const targetBytes = 50 * 1024; // 51,200 bytes

  // If already under 50KB and already JPEG, no compression needed
  if (file.size <= targetBytes && file.type === "image/jpeg") {
    const previewUrl = URL.createObjectURL(file);
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      previewUrl,
      ratio: 0,
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

  // Cap large initial dimensions proportionally
  const maxInitialDim = 1200;
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
  const ctx = canvas.getContext("2d");

  let quality = 0.82;
  let bestBlob = null;

  for (let iteration = 0; iteration < 8; iteration++) {
    canvas.width = Math.max(100, width);
    canvas.height = Math.max(100, height);

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

    if (blob.size <= targetBytes) {
      break;
    }

    if (quality > 0.45) {
      quality -= 0.15;
    } else {
      width = Math.round(width * 0.78);
      height = Math.round(height * 0.78);
      quality = 0.6;
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
  };
}
