import cloudinary from "@/lib/cloudinary";
import { fetchAndPrepareFalImageForCloudinary } from "@/lib/prepare-fal-image-for-cloudinary";

export async function uploadFalImageUrlToCloudinary(options: {
  imageUrl: string;
  folder: string;
  publicId: string;
  overwrite?: boolean;
}): Promise<{ publicId: string; secureUrl: string }> {
  const jpegBuffer = await fetchAndPrepareFalImageForCloudinary(options.imageUrl);
  const dataUri = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: options.folder,
    public_id: options.publicId,
    resource_type: "image",
    overwrite: options.overwrite ?? false,
  });
  return { publicId: result.public_id, secureUrl: result.secure_url };
}
