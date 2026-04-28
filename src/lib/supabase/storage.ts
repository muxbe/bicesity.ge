import { getAuthHeaders } from "@/lib/auth/request-headers";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function validateCatalogImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only JPEG, PNG, WEBP, or AVIF images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 5MB or smaller.";
  }
  return null;
}

type UploadImageResponse = {
  data?: {
    publicUrl: string;
  };
  error?: string;
  details?: unknown;
};

function uploadErrorMessage(payload: UploadImageResponse | null): string {
  const fallback = "Upload failed.";
  const message = payload?.error ?? fallback;
  const details = payload?.details;
  if (
    details &&
    typeof details === "object" &&
    "message" in details &&
    typeof details.message === "string"
  ) {
    return `${message} ${details.message}`;
  }
  return message;
}

export async function uploadCatalogImageFile(file: File): Promise<string> {
  const validationError = validateCatalogImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/catalog/images", {
    method: "POST",
    headers: await getAuthHeaders("admin"),
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as UploadImageResponse | null;

  if (!response.ok || !payload?.data?.publicUrl) {
    throw new Error(uploadErrorMessage(payload));
  }

  return payload.data.publicUrl;
}
