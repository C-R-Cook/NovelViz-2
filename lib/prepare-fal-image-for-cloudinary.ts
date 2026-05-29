import sharp from "sharp";

/** Cloudinary upload limit (bytes) for remote fetch and direct upload. */
export const CLOUDINARY_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Resize and re-encode fal output (often large PNG from Seedream) so Cloudinary accepts it.
 * Same approach as the admin T2I tester route.
 */
export async function prepareFalImageBufferForCloudinary(
  inputBuffer: Buffer,
): Promise<Buffer> {
  const pipeline = () =>
    sharp(inputBuffer)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true });

  let quality = 85;
  let out = await pipeline().jpeg({ quality, mozjpeg: true }).toBuffer();

  while (out.length > CLOUDINARY_UPLOAD_MAX_BYTES && quality > 45) {
    quality -= 10;
    out = await pipeline().jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  if (out.length > CLOUDINARY_UPLOAD_MAX_BYTES) {
    throw new Error(
      `Prepared image still exceeds Cloudinary limit (${out.length} > ${CLOUDINARY_UPLOAD_MAX_BYTES})`,
    );
  }

  return out;
}

export async function fetchAndPrepareFalImageForCloudinary(
  imageUrl: string,
  fetchTimeoutMs = 60_000,
): Promise<Buffer> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(fetchTimeoutMs) });
  if (!res.ok) {
    throw new Error(`Failed to download generated image (HTTP ${res.status})`);
  }
  const inputBuffer = Buffer.from(await res.arrayBuffer());
  return prepareFalImageBufferForCloudinary(inputBuffer);
}
