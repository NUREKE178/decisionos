import { requireSupabase } from "./supabaseClient.js";

const BUCKET = "variant-assets";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateAssetFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Недопустимый тип файла. Разрешены: JPEG, PNG, WEBP, GIF.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("Файл слишком большой (максимум 5 МБ).");
  }
}

function extensionFor(file) {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "bin";
}

/** Uploads a variant image under <org_id>/<experiment_id>/<random>.<ext> --
 * that path shape is what the storage RLS policies (0005_storage.sql) check
 * against can_manage_org(). Returns { url, path } -- `path` is needed later
 * to delete the object (e.g. replacing an image). */
export async function uploadVariantAsset({ orgId, experimentId, file }) {
  validateAssetFile(file);
  const sb = requireSupabase();
  const path = `${orgId}/${experimentId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteVariantAsset(path) {
  if (!path) return;
  const sb = requireSupabase();
  await sb.storage.from(BUCKET).remove([path]);
}

/** Recovers the storage path from a public URL this module produced, so a
 * variant row that only stored assetUrl (not the path) can still be cleaned
 * up later. */
export function pathFromPublicUrl(url) {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

const POST_IMAGES_BUCKET = "post-images";

/** Uploads a post's optional image under <author_id>/<random>.<ext> --
 * matches the storage RLS policies in 0010_post_images.sql, which check the
 * folder name against auth.uid() directly (posts aren't org-scoped, so
 * there's no organization_id to key the path on like uploadVariantAsset
 * does). Same type/size validation as variant assets -- this checks the
 * file is really an image and isn't oversized; it is NOT a content/
 * decency check (no visual moderation capability is available here). */
export async function uploadPostImage({ authorId, file }) {
  validateAssetFile(file);
  const sb = requireSupabase();
  const path = `${authorId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await sb.storage.from(POST_IMAGES_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(POST_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
