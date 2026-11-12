import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading2,
  ImagePlus,
  Undo,
  Redo,
  Eye,
} from "lucide-react";
import { db, saveArticle } from "./api";
import { useAuth } from "./auth";
import { Image, RichBody, State } from "./components";
import { DeskHeading, MediaLibrary } from "./Newsroom";
import {
  allowedStatuses,
  canEdit,
  categories,
  isEditor,
  label,
  type Article,
  type Node,
  type Status,
} from "./types";
const AssetImage = TiptapImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(({ node }: NodeViewProps) => (
      <NodeViewWrapper>
        <Image path={node.attrs.src} alt={node.attrs.alt} />
        <small>{node.attrs.title}</small>
      </NodeViewWrapper>
    ));
  },
});
export function ArticleEditor() {
  const { id } = useParams();
  return <EditorForm key={id ?? "new"} id={id} />;
}
function EditorForm({ id }: { id?: string }) {
  const { role, session } = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article>(),
    [title, setTitle] = useState(""),
    [subtitle, setSubtitle] = useState(""),
    [category, setCategory] = useState("crime-justice"),
    [cover, setCover] = useState<string | null>(null),
    [caption, setCaption] = useState(""),
    [tags, setTags] = useState(""),
    [featured, setFeatured] = useState(false),
    [status, setStatus] = useState<Status>("draft"),
    [comment, setComment] = useState(""),
    [content, setContent] = useState<Node>({ type: "doc", content: [] }),
    [loading, setLoading] = useState(!!id),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState(""),
    [media, setMedia] = useState<"cover" | "inline" | null>(null),
    [preview, setPreview] = useState(false),
    [reviews, setReviews] = useState<
      { id: number; to_status: Status; comment: string; created_at: string }[]
    >([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (media && !dialog.current?.open) dialog.current?.showModal();
  }, [media]);
  const editable =
    (!id || !!article) && canEdit(role, session?.user.id ?? "", article);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      AssetImage.configure({ allowBase64: false }),
    ],
    content: { type: "doc", content: [] },
    editable,
    onUpdate: ({ editor }) => {
      setContent(editor.getJSON() as Node);
      setDirty(true);
    },
    editorProps: {
      attributes: { "aria-label": "Article body", class: "rich-editor" },
    },
  });
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  useEffect(() => {
    if (!id || !editor) return;
    let active = true;
    Promise.all([
      db!.from("articles").select("*,article_tags(tag)").eq("id", id).single(),
      db!
        .from("editorial_reviews")
        .select("*")
        .eq("article_id", id)
        .order("created_at", { ascending: false }),
    ])
      .then(([result, review]) => {
        if (!active) return;
        if (result.error) {
          setError(result.error.message);
          return;
        }
        if (review.error) {
          setError(review.error.message);
          return;
        }
        const a = result.data as Article;
        setArticle(a);
        setTitle(a.title);
        setSubtitle(a.subtitle);
        setCategory(a.category);
        setCover(a.cover_path);
        setCaption(a.cover_caption);
        setTags(a.article_tags?.map((t) => t.tag).join(", ") ?? "");
        setFeatured(a.featured);
        setStatus(a.status);
        setContent(a.content);
        editor.commands.setContent(a.content, { emitUpdate: false });
        setReviews(review.data ?? []);
        setDirty(false);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, editor]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  const blocker = useBlocker(dirty && !busy);
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("Leave this story and discard unsaved changes?"))
        blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  function change(fn: () => void) {
    fn();
    setDirty(true);
    setNotice("");
  }
  async function save(next: Status) {
    if (!editor || !editable) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveArticle(
        {
          id: article?.id,
          version: article?.version,
          title,
          subtitle,
          category,
          content,
          cover_path: cover,
          cover_caption: caption,
          featured,
        },
        next,
        comment,
        tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      );
      setArticle(saved);
      setStatus(saved.status);
      setDirty(false);
      setComment("");
      setNotice(`Story saved as ${label(saved.status)}.`);
      if (!id) navigate(`/newsroom/edit/${saved.id}`, { replace: true });
      else {
        const { data, error } = await db!
          .from("editorial_reviews")
          .select("*")
          .eq("article_id", saved.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setReviews(data ?? []);
      }
    } catch (e) {
      setError(
        typeof e === "object" && e && "message" in e
          ? String(e.message)
          : "Saving failed. Your unsaved changes remain in the editor.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (role === "photographer")
    return <p>Use the Media Library to contribute photographs.</p>;
  return (
    <>
      <DeskHeading
        title={id ? "Story editor" : "Create a story"}
        subtitle={
          article
            ? `Version ${article.version} · ${label(article.status)}`
            : "A blank page. A new perspective."
        }
      />
      <State loading={loading}>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!editable && (
          <p className="notice">
            This story is read-only for your role in its current status.
          </p>
        )}
        <div className="editor-actions">
          <span className={dirty ? "red" : "muted"}>
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button
            className="button subtle"
            onClick={() => setPreview(!preview)}
          >
            <Eye size={16} />
            {preview ? "Back to editing" : "Preview"}
          </button>
        </div>
        {preview ? (
          <article className="preview article-body">
            <span className="eyebrow">
              PREVIEW · {categories.find((c) => c[0] === category)?.[1]}
            </span>
            <h1>{title || "Untitled story"}</h1>
            <p>{subtitle}</p>
            {cover && <Image path={cover} alt={caption} />}
            <RichBody node={content} />
          </article>
        ) : (
          <fieldset disabled={!editable || busy} className="editor-fields">
            <label>
              Headline
              <input
                className="headline-input"
                value={title}
                maxLength={240}
                placeholder="Tell the story in a headline"
                onChange={(e) => change(() => setTitle(e.target.value))}
              />
            </label>
            <label>
              Subheadline
              <textarea
                value={subtitle}
                maxLength={500}
                placeholder="Add context in a sentence or two"
                onChange={(e) => change(() => setSubtitle(e.target.value))}
              />
            </label>
            <div className="form-row">
              <label>
                Category
                <select
                  value={category}
                  onChange={(e) => change(() => setCategory(e.target.value))}
                >
                  {categories.map(([s, n]) => (
                    <option value={s} key={s}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tags (comma separated)
                <input
                  value={tags}
                  onChange={(e) => change(() => setTags(e.target.value))}
                />
              </label>
            </div>
            <label>Cover photograph</label>
            {cover && (
              <div className="cover-preview">
                <Image path={cover} alt={caption} />
                <button onClick={() => change(() => setCover(null))}>
                  Remove cover
                </button>
              </div>
            )}
            <button className="button subtle" onClick={() => setMedia("cover")}>
              <ImagePlus size={16} />
              Choose cover
            </button>
            <label>
              Cover caption
              <input
                value={caption}
                onChange={(e) => change(() => setCaption(e.target.value))}
                maxLength={1000}
              />
            </label>
            <label>Article body</label>
            <div
              className="toolbar"
              role="toolbar"
              aria-label="Text formatting"
            >
              {[
                {
                  name: "Bold",
                  icon: <Bold size={17} />,
                  run: () => editor?.chain().focus().toggleBold().run(),
                  active: editor?.isActive("bold"),
                },
                {
                  name: "Italic",
                  icon: <Italic size={17} />,
                  run: () => editor?.chain().focus().toggleItalic().run(),
                  active: editor?.isActive("italic"),
                },
                {
                  name: "Heading",
                  icon: <Heading2 size={17} />,
                  run: () =>
                    editor?.chain().focus().toggleHeading({ level: 2 }).run(),
                  active: editor?.isActive("heading"),
                },
                {
                  name: "Bullet list",
                  icon: <List size={17} />,
                  run: () => editor?.chain().focus().toggleBulletList().run(),
                  active: editor?.isActive("bulletList"),
                },
                {
                  name: "Numbered list",
                  icon: <ListOrdered size={17} />,
                  run: () => editor?.chain().focus().toggleOrderedList().run(),
                  active: editor?.isActive("orderedList"),
                },
                {
                  name: "Quote",
                  icon: <Quote size={17} />,
                  run: () => editor?.chain().focus().toggleBlockquote().run(),
                  active: editor?.isActive("blockquote"),
                },
                {
                  name: "Insert photo",
                  icon: <ImagePlus size={17} />,
                  run: () => setMedia("inline"),
                },
                {
                  name: "Undo",
                  icon: <Undo size={17} />,
                  run: () => editor?.chain().focus().undo().run(),
                },
                {
                  name: "Redo",
                  icon: <Redo size={17} />,
                  run: () => editor?.chain().focus().redo().run(),
                },
              ].map((t) => (
                <button
                  type="button"
                  key={t.name}
                  title={t.name}
                  aria-label={t.name}
                  aria-pressed={!!t.active}
                  onClick={t.run}
                >
                  {t.icon}
                </button>
              ))}
            </div>
            <EditorContent editor={editor} />
            {isEditor(role) && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => change(() => setFeatured(e.target.checked))}
                />
                Feature on the homepage
              </label>
            )}
            <div className="moderation">
              <h2>Editorial workflow</h2>
              <label>
                Editor comment
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={5000}
                  placeholder="Required when requesting changes"
                />
              </label>
              <div className="form-row">
                <label>
                  Next status
                  <select
                    value={
                      allowedStatuses(role).includes(status) ? status : "draft"
                    }
                    onChange={(e) => setStatus(e.target.value as Status)}
                  >
                    {allowedStatuses(role).map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button red-button"
                  disabled={busy || !title.trim() || !editable}
                  onClick={() =>
                    void save(
                      allowedStatuses(role).includes(status) ? status : "draft",
                    )
                  }
                >
                  {busy ? "Saving…" : "Save story & status"}
                </button>
                <button
                  className="button subtle"
                  disabled={busy || !title.trim() || !editable}
                  onClick={() => void save("draft")}
                >
                  Save as draft
                </button>
              </div>
            </div>
          </fieldset>
        )}
        <section className="review-history">
          <h2>Review history</h2>
          {reviews.map((r) => (
            <div className="activity" key={r.id}>
              <span className="status">{label(r.to_status)}</span>
              <span>{r.comment || "Status updated"}</span>
              <small>{new Date(r.created_at).toLocaleString("en-US")}</small>
            </div>
          ))}
          {!reviews.length && (
            <p className="muted">Editorial comments will appear here.</p>
          )}
        </section>
        {media && (
          <dialog
            ref={dialog}
            onCancel={() => setMedia(null)}
            className="media-dialog"
            aria-label="Choose an image"
          >
            <button className="button" autoFocus onClick={() => setMedia(null)}>
              Close image selector
            </button>
            <MediaLibrary
              onSelect={(asset) => {
                if (media === "cover") {
                  setCover(asset.path);
                  setCaption(asset.caption);
                } else
                  editor
                    ?.chain()
                    .focus()
                    .setImage({
                      src: asset.path,
                      alt: asset.caption,
                      title: asset.caption,
                    })
                    .run();
                setDirty(true);
                setMedia(null);
              }}
            />
          </dialog>
        )}
      </State>
    </>
  );
}
