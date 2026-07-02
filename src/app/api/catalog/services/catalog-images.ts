import type {
  CatalogItemRow,
  ProductImageStorageRow,
} from "@/app/api/catalog/services/catalog-types";
import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";
import { normalizeProductImages as normalizeCatalogProductImages } from "@/features/catalog/repositories/catalog-helpers";
import { AdapterError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export function pickPrimaryImage(
  images: CatalogItemRow["product_images"],
  category: ProductCategory
): string {
  return normalizeCatalogProductImages(extractImageUrls(images), category)[0];
}

export function extractImageUrls(images: CatalogItemRow["product_images"]): string[] {
  if (!images || images.length === 0) {
    return [];
  }

  const byOrder = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const primary = byOrder.find((image) => image.is_primary && image.external_url);
  const ordered = [
    ...(primary ? [primary] : []),
    ...byOrder.filter((image) => image !== primary),
  ];
  const seen = new Set<string>();
  return ordered
    .map((image) => image.external_url?.trim() || storagePublicUrl(image.bucket_name, image.object_path))
    .filter((url) => {
      if (!url || seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });
}

export function storagePublicUrl(bucket: string | null | undefined, objectPath: string | null | undefined): string {
  const trimmedBucket = bucket?.trim();
  const trimmedPath = objectPath?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!trimmedBucket || !trimmedPath || !supabaseUrl) {
    return "";
  }

  const encodedPath = trimmedPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(trimmedBucket)}/${encodedPath}`;
}

export function storageObjectFromPublicUrl(url: string): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && parsed.origin !== new URL(supabaseUrl).origin) {
      return null;
    }

    const prefixes = ["/storage/v1/object/public/", "/storage/v1/render/image/public/"];
    const prefix = prefixes.find((candidate) => parsed.pathname.startsWith(candidate));
    if (!prefix) {
      return null;
    }

    const remainder = parsed.pathname.slice(prefix.length);
    const separatorIndex = remainder.indexOf("/");
    if (separatorIndex <= 0 || separatorIndex === remainder.length - 1) {
      return null;
    }

    const bucket = decodeURIComponent(remainder.slice(0, separatorIndex));
    const path = remainder
      .slice(separatorIndex + 1)
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");

    if (!bucket || !path) {
      return null;
    }
    return { bucket, path };
  } catch {
    return null;
  }
}

export function storageObjectFromImageRow(
  image: ProductImageStorageRow
): { bucket: string; path: string } | null {
  const bucket = image.bucket_name?.trim();
  const path = image.object_path?.trim();
  if (bucket && path) {
    return { bucket, path };
  }
  const externalUrl = image.external_url?.trim();
  return externalUrl ? storageObjectFromPublicUrl(externalUrl) : null;
}

export function storageObjectKey(object: { bucket: string; path: string }) {
  return `${object.bucket}/${object.path}`;
}

export function uniqueStorageObjects(rows: ProductImageStorageRow[]) {
  const seen = new Set<string>();
  const objects: Array<{ bucket: string; path: string }> = [];
  for (const row of rows) {
    const object = storageObjectFromImageRow(row);
    if (!object) {
      continue;
    }
    const key = storageObjectKey(object);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    objects.push(object);
  }
  return objects;
}

export function imageInsertRow(productId: string, image: string, index: number) {
  const storageObject = storageObjectFromPublicUrl(image);
  return {
    catalog_item_id: productId,
    bucket_name: storageObject?.bucket ?? null,
    object_path: storageObject?.path ?? null,
    external_url: storageObject ? null : image,
    is_primary: index === 0,
    sort_order: index,
  };
}

export function normalizeProductImages(images: string[] | undefined, fallbackImage?: string): string[] {
  const seen = new Set<string>();
  return [...(images ?? []), fallbackImage ?? ""]
    .map((image) => image.trim())
    .filter((image) => {
      if (!image || seen.has(image)) {
        return false;
      }
      seen.add(image);
      return true;
    })
    .slice(0, 5);
}

export async function removeUnusedStorageObjects(
  candidateRows: ProductImageStorageRow[],
  readErrorMessage: string,
  removeErrorMessage: string
) {
  const candidateObjects = uniqueStorageObjects(candidateRows);
  if (candidateObjects.length === 0) {
    return;
  }

  const supabase = getServerSupabaseAdminClient();
  const { data: remainingImageRows, error: remainingImageError } = await supabase
    .from("product_images")
    .select("bucket_name,object_path,external_url");

  if (remainingImageError) {
    throw new AdapterError(readErrorMessage, remainingImageError);
  }

  const stillUsedKeys = new Set(
    uniqueStorageObjects(((remainingImageRows ?? []) as ProductImageStorageRow[]).filter(Boolean)).map(
      storageObjectKey
    )
  );
  const unusedObjects = candidateObjects.filter((object) => !stillUsedKeys.has(storageObjectKey(object)));
  const pathsByBucket = new Map<string, string[]>();
  for (const object of unusedObjects) {
    pathsByBucket.set(object.bucket, [...(pathsByBucket.get(object.bucket) ?? []), object.path]);
  }

  for (const [bucket, paths] of Array.from(pathsByBucket.entries())) {
    const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
    if (storageError) {
      throw new AdapterError(removeErrorMessage, storageError);
    }
  }
}

export async function syncProductImages(productId: string, images: string[]) {
  const supabase = getServerSupabaseAdminClient();
  const { data: previousImageRows, error: readPreviousError } = await supabase
    .from("product_images")
    .select("bucket_name,object_path,external_url")
    .eq("catalog_item_id", productId);

  if (readPreviousError) {
    throw new AdapterError("Failed to read product images before replacing them.", readPreviousError);
  }

  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("catalog_item_id", productId);

  if (deleteError) {
    throw new AdapterError("Failed to replace product images.", deleteError);
  }

  if (images.length === 0) {
    await removeUnusedStorageObjects(
      ((previousImageRows ?? []) as ProductImageStorageRow[]).filter(Boolean),
      "Product images were removed, but image cleanup could not verify remaining usage.",
      "Product images were removed, but one or more image files could not be removed from storage."
    );
    return;
  }

  const { error: insertError } = await supabase.from("product_images").insert(
    images.map((image, index) => imageInsertRow(productId, image, index))
  );

  if (insertError) {
    throw new AdapterError("Failed to attach product images.", insertError);
  }

  await removeUnusedStorageObjects(
    ((previousImageRows ?? []) as ProductImageStorageRow[]).filter(Boolean),
    "Product images were replaced, but image cleanup could not verify remaining usage.",
    "Product images were replaced, but one or more old image files could not be removed from storage."
  );
}
