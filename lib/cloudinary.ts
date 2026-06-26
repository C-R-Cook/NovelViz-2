import { v2 as cloudinary } from "cloudinary";

function ensureCloudinaryConfigured(): void {
  const current = cloudinary.config();
  if (current.api_key && current.cloud_name) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return;
  }

  const url = process.env.CLOUDINARY_URL?.trim();
  const match = url?.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?]+)/);
  if (match) {
    cloudinary.config({
      api_key: decodeURIComponent(match[1]!),
      api_secret: decodeURIComponent(match[2]!),
      cloud_name: match[3]!,
      secure: true,
    });
  }
}

ensureCloudinaryConfigured();

export default cloudinary;


export type CloudinaryEnvFolder = "dev" | "prod";



/** Legacy paths (pre env split) — still accepted for in-flight draft commits. */

export const LEGACY_CLOUDINARY_DRAFT_PREFIX = "novelviz/cover-drafts/";

export const LEGACY_CLOUDINARY_COVERS_PREFIX = "novelviz/covers/";

export const LEGACY_CLOUDINARY_GALLERY_PREFIX = "novelviz/gallery/";



const CLOUDINARY_ROOT = "novelviz";



/**

 * Which Cloudinary subfolder to use under `novelviz/{dev|prod}/…`.

 * Override with `NOVELVIZ_CLOUDINARY_ENV=dev|prod` when auto-detection is wrong.

 */

export function getCloudinaryEnvFolder(): CloudinaryEnvFolder {

  const explicit = process.env.NOVELVIZ_CLOUDINARY_ENV?.trim().toLowerCase();

  if (explicit === "prod" || explicit === "production") return "prod";

  if (explicit === "dev" || explicit === "development") return "dev";

  if (process.env.VERCEL_ENV === "production") return "prod";

  return "dev";

}



/** Build a Cloudinary folder path for the current runtime env, e.g. `novelviz/dev/gallery`. */

export function cloudinaryFolder(...segments: string[]): string {

  return cloudinaryFolderForEnv(getCloudinaryEnvFolder(), ...segments);

}



/** Build a Cloudinary folder path for a specific env segment. */

export function cloudinaryFolderForEnv(

  env: CloudinaryEnvFolder,

  ...segments: string[]

): string {

  return [CLOUDINARY_ROOT, env, ...segments.filter(Boolean)].join("/");

}



export function cloudinaryGalleryFolder(): string {

  return cloudinaryFolder("gallery");

}



export function cloudinaryCoverUserFolder(): string {

  return cloudinaryFolder("covers", "user");

}



export function cloudinaryCoverAiFolder(): string {

  return cloudinaryFolder("covers", "ai");

}



export function cloudinaryCoverDraftsFolder(bookId: string): string {

  return cloudinaryFolder("cover-drafts", bookId);

}



/** Committed cover folder for a book (user upload vs Cover AI). */

export function cloudinaryCommittedCoverFolder(coverIsAiGenerated: boolean): string {

  return coverIsAiGenerated ? cloudinaryCoverAiFolder() : cloudinaryCoverUserFolder();

}



export function cloudinaryCommittedCoverFolderForEnv(

  env: CloudinaryEnvFolder,

  coverIsAiGenerated: boolean,

): string {

  return coverIsAiGenerated

    ? cloudinaryFolderForEnv(env, "covers", "ai")

    : cloudinaryFolderForEnv(env, "covers", "user");

}



export function isCloudinaryHttpsUrl(url: string | null | undefined): boolean {

  return typeof url === "string" && url.startsWith("https://") && url.includes("res.cloudinary.com");

}


