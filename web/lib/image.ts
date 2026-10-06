// Resize photos in the browser so every upload lands well under the 1 MB limit, even big phone photos.
export async function shrink(file: File, maxEdge = 1800): Promise<Blob> {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) throw new Error(`${file.name} isn’t an image this browser can read. Try a JPEG.`);
  const k = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.84, 0.74, 0.62, 0.5]) {
    const b = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', q));
    if (b && b.size < 900 * 1024) return b;
  }
  throw new Error(`${file.name} is still too large after resizing.`);
}
