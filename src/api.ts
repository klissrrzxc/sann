import { createClient } from "@supabase/supabase-js";
import type { Article, Node, Status } from "./types";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const db = url && key ? createClient(url, key) : null;
export const demo = import.meta.env.VITE_DEMO_MODE === "true";
export const requireDb = () => {
  if (!db)
    throw new Error(
      "Database is not configured. Connect Supabase to activate the newsroom.",
    );
  return db;
};
export async function listArticles(publicOnly = true) {
  const q = requireDb()
    .from("articles")
    .select("*,profiles(*),article_tags(tag)")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  const { data, error } = await (publicOnly ? q.eq("status", "published") : q);
  if (error) throw error;
  return data as Article[];
}
export async function saveArticle(
  article: Partial<Article> & { content: Node },
  status: Status,
  comment: string,
  tags: string[],
) {
  const { data, error } = await requireDb().rpc("save_article", {
    p_id: article.id ?? null,
    p_version: article.version ?? 0,
    p_data: { ...article, tags },
    p_status: status,
    p_comment: comment,
  });
  if (error) throw error;
  return data as Article;
}
export async function uploadImage(file: File, caption: string, userId: string) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP image under 20 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image compression failed"))),
      "image/webp",
      0.84,
    ),
  );
  if (blob.size > 5 * 1024 * 1024)
    throw new Error("Compressed image exceeds 5 MB. Please resize it.");
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const client = requireDb();
  const { error } = await client.storage
    .from("newsroom")
    .upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  const { error: registration } = await client.rpc("register_media", {
    p_path: path,
    p_caption: caption,
  });
  if (registration)
    throw new Error(
      "Image uploaded but registration failed. Contact the administrator to remove the orphan upload.",
    );
  return path;
}
export async function removeImage(path: string) {
  const client = requireDb();
  const { error: prepare } = await client.rpc("prepare_media_delete", {
    p_path: path,
  });
  if (prepare) throw prepare;
  const { error } = await client.storage.from("newsroom").remove([path]);
  if (error) throw error;
  const { error: forget } = await client.rpc("forget_media", { p_path: path });
  if (forget) throw forget;
}
