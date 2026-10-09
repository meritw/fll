export const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm";

export const MEDIA_MAX_BYTES = 512 * 1024 * 1024;

const EXT_TO_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export function resolveMediaContentType(file: { name: string; type: string }) {
  if (file.type && Object.values(EXT_TO_TYPE).includes(file.type)) {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_TYPE[ext] ?? "";
}

export function isImageType(contentType: string) {
  return contentType.startsWith("image/");
}

export function isVideoType(contentType: string) {
  return contentType.startsWith("video/");
}
