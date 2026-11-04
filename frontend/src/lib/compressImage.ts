// Shrinks a photo in the browser before it is uploaded: at most 1280px on the long side, saved as JPEG,
// and the quality is lowered until the file is under the target size (default 300 KB).
const MAX_SIDE = 1280;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} is not a photo we can open`));
    };
    img.src = url;
  });
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

export async function compressImage(file: File, maxKb = 300): Promise<File> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let blob: Blob | null = null;
  for (let quality = 0.85; quality >= 0.4; quality -= 0.1) {
    blob = await toBlob(canvas, quality);
    if (blob && blob.size <= maxKb * 1024) break;
  }
  if (!blob || blob.size >= file.size) return file; // already small, keep the original
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

export const formatKb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
