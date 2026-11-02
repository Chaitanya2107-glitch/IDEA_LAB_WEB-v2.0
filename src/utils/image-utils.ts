/**
 * Utility for client-side image processing before upload.
 * Limits:
 * - > 10MB: Reject
 * - 5MB - 10MB: Compress to ~2MB
 * - < 5MB: Original
 */

export const processImageUpload = async (file: File): Promise<File> => {
  const MB = 1024 * 1024;
  const sizeMB = file.size / MB;

  // 1. Refuse if > 10MB
  if (sizeMB > 10) {
    throw new Error("put the max as 10 mb");
  }

  // 2. Return as-is if < 5MB or not an image
  if (sizeMB < 5 || !file.type.startsWith("image/")) {
    return file;
  }

  // 3. Compress if between 5MB and 10MB
  console.log(`Compressing ${file.name} (${sizeMB.toFixed(2)}MB)...`);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Downscale if extremely large (e.g. 4K+)
        const MAX_DIM = 2500;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          } else {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file); // Fallback to original if canvas fails
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Quality 0.7 is usually a sweet spot for high reduction with good visuals
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              console.log(`Compressed to ${(compressedFile.size / MB).toFixed(2)}MB`);
              resolve(compressedFile);
            } else {
              resolve(file); // Fallback
            }
          },
          "image/jpeg",
          0.7
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};
