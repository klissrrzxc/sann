import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, Search, X } from "lucide-react";
import { db, demo } from "./api";
import { categories, safeLink, type Article, type Node } from "./types";
export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="San Andreas News Network home">
      <strong>
        SANN<span>■</span>
      </strong>
      <small>
        SAN ANDREAS
        <br />
        NEWS NETWORK
      </small>
    </Link>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  const [tagline, setTagline] = useState(
    "Independent reporting. Across the state.",
  );
  useEffect(() => {
    db?.from("site_settings")
      .select("value")
      .eq("key", "tagline")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTagline(data.value);
      });
  }, []);
  return (
    <>
      <div className="utility">
        <span>INDEPENDENT. IN-GAME. IN THE KNOW.</span>
        <Link to="/about">
          About the network <ArrowUpRight size={12} />
        </Link>
      </div>
      <header>
        <div className="masthead">
          <Logo />
          <div className="edition">
            THE SAN ANDREAS EDITION
            <br />
            <b>{tagline}</b>
          </div>
          <Link to="/newsroom" className="button dark">
            Enter Newsroom <ArrowUpRight size={15} />
          </Link>
          <button
            className="mobile-menu"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        <nav className={open ? "open" : ""} onClick={() => setOpen(false)}>
          <Link to="/">Top Stories</Link>
          {categories.map(([slug, name]) => (
            <Link key={slug} to={`/category/${slug}`}>
              {name}
            </Link>
          ))}
          <Link to="/archive" aria-label="Search archive">
            <Search size={18} />
          </Link>
        </nav>
      </header>
      {demo && (
        <div className="demo-banner">
          FICTIONAL RP PREVIEW — Read-only sample stories. Database actions
          require a configured Supabase project.
        </div>
      )}
    </>
  );
}
export function Footer() {
  return (
    <footer>
      <Logo />
      <p>Independent reporting. Across San Andreas.</p>
      <div>
        <Link to="/about">Our newsroom</Link>
        <Link to="/archive">Archive & search</Link>
        <Link to="/newsroom">Staff access</Link>
      </div>
      <small>
        © {new Date().getFullYear()} San Andreas News Network. A fictional GTA
        RolePlay news agency.
        <br />
        Not affiliated with Rockstar Games or a real-world news organization.
      </small>
    </footer>
  );
}
export function State({
  loading,
  error,
  empty,
  children,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="skeleton" role="status" aria-label="Loading articles">
        <div />
        <div />
        <div />
      </div>
    );
  if (error)
    return (
      <div className="notice error" role="alert">
        <h2>Unable to load this edition</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  if (empty)
    return (
      <div className="notice">
        <h2>The next story starts here.</h2>
        <p>No published articles match this view. Check back soon.</p>
        <Link to="/">Return to Top Stories →</Link>
      </div>
    );
  return <>{children}</>;
}
export function Image({
  path,
  alt = "",
  className = "",
}: {
  path?: string | null;
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    setUrl("");
    if (!path || path.startsWith("illustration:") || !db) return;
    db.storage
      .from("newsroom")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? "");
      });
    return () => {
      active = false;
    };
  }, [path]);
  if (path?.startsWith("illustration:"))
    return (
      <img
        className={className}
        src={`${import.meta.env.BASE_URL}illustrations/${path.split(":")[1]}.svg`}
        alt={alt}
        loading="lazy"
      />
    );
  return url ? (
    <img className={className} src={url} alt={alt} loading="lazy" />
  ) : (
    <div
      role="img"
      aria-label={alt || "SANN image unavailable"}
      className={`image-placeholder ${className}`}
    >
      <span>
        SANN<span className="red"> / </span>FIELD NOTES
      </span>
    </div>
  );
}
export const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Los_Angeles",
      }).format(new Date(value))
    : "";
export function Card({
  article,
  compact = false,
}: {
  article: Article;
  compact?: boolean;
}) {
  return (
    <article className={compact ? "card compact" : "card"}>
      <Link to={`/article/${article.slug}`} tabIndex={-1} aria-hidden="true">
        <Image path={article.cover_path} alt={article.cover_caption} />
      </Link>
      <div>
        <Link className="eyebrow" to={`/category/${article.category}`}>
          {categories.find((x) => x[0] === article.category)?.[1]}
        </Link>
        <h3>
          <Link to={`/article/${article.slug}`}>{article.title}</Link>
        </h3>
        {!compact && <p>{article.subtitle}</p>}
        <small>
          {date(article.published_at)} <span>·</span>{" "}
          {article.profiles?.rp_name ?? "SANN desk"}
        </small>
      </div>
    </article>
  );
}
export function RichBody({
  node,
  depth = 0,
}: {
  node: Node;
  depth?: number;
}): ReactNode {
  if (depth > 50) return null;
  const children = node.content?.map((n, i) => (
    <RichBody key={i} node={n} depth={depth + 1} />
  ));
  if (node.type === "text") {
    let t: ReactNode = node.text ?? "";
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") t = <strong>{t}</strong>;
      if (mark.type === "italic") t = <em>{t}</em>;
      if (mark.type === "strike") t = <s>{t}</s>;
      if (mark.type === "code") t = <code>{t}</code>;
    }
    return t;
  }
  switch (node.type) {
    case "doc":
      return <>{children}</>;
    case "paragraph":
      return <p>{children}</p>;
    case "heading":
      return node.attrs?.level === 3 ? (
        <h3>{children}</h3>
      ) : (
        <h2>{children}</h2>
      );
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "hardBreak":
      return <br />;
    case "horizontalRule":
      return <hr />;
    case "codeBlock":
      return <pre>{children}</pre>;
    case "image":
      return (
        <figure>
          <Image
            path={typeof node.attrs?.src === "string" ? node.attrs.src : null}
            alt={String(node.attrs?.alt ?? "Article photograph")}
          />
          <figcaption>{String(node.attrs?.title ?? "")}</figcaption>
        </figure>
      );
    default:
      return <>{children}</>;
  }
}
export function Avatar({ url, name }: { url: string; name: string }) {
  const src = safeLink(url);
  return src ? (
    <img className="avatar" src={src} alt={name} referrerPolicy="no-referrer" />
  ) : (
    <div className="avatar">
      {name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")}
    </div>
  );
}
