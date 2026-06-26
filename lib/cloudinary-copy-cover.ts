import cloudinary, {
  type CloudinaryEnvFolder,
  cloudinaryCommittedCoverFolderForEnv,
  isCloudinaryHttpsUrl,
} from "@/lib/cloudinary";

const COVER_TRANSFORM = [{ width: 400, height: 600, crop: "fit" as const }];

/** Copy a remote cover into `novelviz/{env}/covers/user|ai/{bookId}`. */
export async function copyCoverToEnvFolder(options: {
  sourceUrl: string;
  bookId: string;
  env: CloudinaryEnvFolder;
  coverIsAiGenerated: boolean;
}): Promise<string> {
  if (!isCloudinaryHttpsUrl(options.sourceUrl)) {
    throw new Error(`Not a Cloudinary HTTPS URL: ${options.sourceUrl.slice(0, 80)}`);
  }
  const result = await cloudinary.uploader.upload(options.sourceUrl, {
    folder: cloudinaryCommittedCoverFolderForEnv(options.env, options.coverIsAiGenerated),
    public_id: options.bookId,
    overwrite: true,
    transformation: COVER_TRANSFORM,
    resource_type: "image",
  });
  return result.secure_url;
}

export async function copyCoverToProdFolder(options: {
  sourceUrl: string;
  bookId: string;
  coverIsAiGenerated: boolean;
}): Promise<string> {
  return copyCoverToEnvFolder({ ...options, env: "prod" });
}
