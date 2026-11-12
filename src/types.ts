export type Role =
  | "administrator"
  | "editor_in_chief"
  | "senior_journalist"
  | "junior_journalist"
  | "photographer";
export type Status =
  "draft" | "pending_review" | "changes_requested" | "published" | "archived";
export interface Node {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: Node[];
}
export interface Profile {
  id: string;
  rp_name: string;
  avatar: string;
  position: string;
  biography: string;
  department: string;
  joined_at: string;
}
export interface Article {
  id: string;
  slug: string;
  author_id: string;
  title: string;
  subtitle: string;
  category: string;
  content: Node;
  cover_path: string | null;
  cover_caption: string;
  status: Status;
  featured: boolean;
  is_demo: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  profiles?: Profile;
  article_tags?: { tag: string }[];
}
export const categories = [
  ["breaking-news", "Breaking News"],
  ["crime-justice", "Crime & Justice"],
  ["politics", "Politics"],
  ["business", "Business"],
  ["investigations", "Investigations"],
  ["entertainment", "Entertainment"],
  ["lifestyle", "Lifestyle"],
  ["interviews", "Interviews"],
];
export const roles: Role[] = [
  "administrator",
  "editor_in_chief",
  "senior_journalist",
  "junior_journalist",
  "photographer",
];
export const label = (s: string) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const isEditor = (r: Role | null) =>
  r === "administrator" || r === "editor_in_chief";
export function canEdit(role: Role | null, userId: string, article?: Article) {
  return (
    !!role &&
    role !== "photographer" &&
    (!article ||
      isEditor(role) ||
      (article.author_id === userId &&
        (role === "senior_journalist" ||
          ["draft", "changes_requested"].includes(article.status))))
  );
}
export function allowedStatuses(role: Role | null): Status[] {
  return isEditor(role)
    ? ["draft", "pending_review", "changes_requested", "published", "archived"]
    : role === "senior_journalist"
      ? ["draft", "pending_review", "published", "archived"]
      : role === "junior_journalist"
        ? ["draft", "pending_review"]
        : [];
}
export function safeLink(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
