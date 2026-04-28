import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCatalogRole } from "@/app/api/catalog/role";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DEFAULT_BUCKET = "product-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function sanitizeFilenameSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only JPEG, PNG, WEBP, or AVIF images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 5MB or smaller.";
  }
  return null;
}

function configuredBucketName(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
}

async function ensurePublicBucket(bucket: string) {
  const supabase = getServerSupabaseAdminClient();
  const { error: readError } = await supabase.storage.getBucket(bucket);
  if (!readError) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_TYPES),
  });

  if (
    createError &&
    !createError.message.toLowerCase().includes("already exists")
  ) {
    throw createError;
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = await getCatalogRole(request);
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can upload product images." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const bucket = configuredBucketName();
    await ensurePublicBucket(bucket);

    const extension = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
      : "jpg";
    const stem = sanitizeFilenameSegment(file.name.replace(/\.[^.]+$/, "")) || "image";
    const path = `catalog/${Date.now()}-${randomUUID()}-${stem}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const supabase = getServerSupabaseAdminClient();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json(
        { error: "Upload failed.", details: uploadError },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!data.publicUrl) {
      return NextResponse.json(
        { error: "Upload succeeded but public URL could not be resolved." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        bucket,
        path,
        publicUrl: data.publicUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected image upload error.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
