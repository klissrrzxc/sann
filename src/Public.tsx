import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Copy, Search } from "lucide-react";
import { db, demo, listArticles } from "./api";
import { demoArticles, demoProfile } from "./demo";
import { Avatar, Card, date, Image, RichBody, State } from "./components";
import { categories, type Article, type Profile } from "./types";
export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (demo) {
      setArticles(demoArticles);
      setLoading(false);
      return;
    }
    listArticles()
      .then((a) => {
        if (active) setArticles(a);
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
  }, []);
  return { articles, loading, error };
}
export function Home() {
  const { articles, loading, error } = useArticles();
  const lead = articles.find((a) => a.featured) ?? articles[0];
  const rest = articles.filter((a) => a.id !== lead?.id);
  return (
    <main>
      <div className="breaking">
        <b>THE WIRE</b>
        <span>
          {articles[0]?.title ??
            "San Andreas News Network · Independent journalism from across the state"}
        </span>
        <Link to="/category/breaking-news" aria-label="Breaking news">
          <ArrowRight size={17} />
        </Link>
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE STORIES THAT MATTER</span>
          <h1>Across the state.</h1>
        </div>
        <span className="edition-date">
          LOS SANTOS • SAN ANDREAS
          <br />
          <b>Journalism with a local perspective.</b>
        </span>
      </div>
      <State loading={loading} error={error} empty={!articles.length}>
        {lead && (
          <section className="lead-grid">
            <article className="lead">
              <Link to={`/article/${lead.slug}`}>
                <div className="lead-image">
                  <Image path={lead.cover_path} alt={lead.cover_caption} />
                  <span className="image-label">SANN SPECIAL REPORT</span>
                </div>
              </Link>
              <Link className="eyebrow" to={`/category/${lead.category}`}>
                {categories.find((c) => c[0] === lead.category)?.[1]}{" "}
                <span> / EXCLUSIVE</span>
              </Link>
              <h2>
                <Link to={`/article/${lead.slug}`}>{lead.title}</Link>
              </h2>
              <p>{lead.subtitle}</p>
              <small>
                By {lead.profiles?.rp_name} <span>·</span>{" "}
                {date(lead.published_at)}
              </small>
            </article>
            <div className="side-stories">
              {rest.slice(0, 2).map((a) => (
                <Card key={a.id} article={a} />
              ))}
            </div>
            <aside className="latest">
              <div className="section-title">
                <h2>Latest dispatches</h2>
                <span className="live-dot" />
              </div>
              {rest.slice(2, 6).map((a, i) => (
                <article key={a.id}>
                  <span className="dispatch-number">0{i + 1}</span>
                  <div>
                    <span className="eyebrow">
                      {categories.find((c) => c[0] === a.category)?.[1]}
                    </span>
                    <h3>
                      <Link to={`/article/${a.slug}`}>{a.title}</Link>
                    </h3>
                    <small>{date(a.published_at)}</small>
                  </div>
                </article>
              ))}
              <Link className="text-link" to="/archive">
                All dispatches <ArrowRight size={15} />
              </Link>
              <div className="mission">
                <b>
                  YOUR STATE.
                  <br />
                  YOUR STORIES.
                </b>
                <p>
                  From the streets of Los Santos to the voices shaping San
                  Andreas.
                </p>
                <Link to="/about">Meet the newsroom ↗</Link>
              </div>
            </aside>
          </section>
        )}
        <section className="editors">
          <div className="section-title">
            <h2>
              Editor's selection<span className="red">.</span>
            </h2>
            <Link to="/archive">
              Explore the archive <ArrowRight size={16} />
            </Link>
          </div>
          <div className="cards-grid">
            {articles
              .filter((a) => a.featured || a.id !== lead?.id)
              .slice(0, 3)
              .map((a) => (
                <Card key={a.id} article={a} />
              ))}
          </div>
        </section>
        <div className="desk-grid">
          {[
            "crime-justice",
            "politics",
            "business",
            "entertainment",
            "investigations",
          ].map((c) => (
            <section key={c}>
              <div className="section-title">
                <h2>{categories.find((x) => x[0] === c)?.[1]}</h2>
                <Link to={`/category/${c}`} aria-label={`More ${c}`}>
                  <ArrowRight size={18} />
                </Link>
              </div>
              {articles
                .filter((a) => a.category === c)
                .slice(0, 2)
                .map((a) => (
                  <Card key={a.id} article={a} compact />
                ))}
            </section>
          ))}
        </div>
      </State>
    </main>
  );
}
export function Archive() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "",
    month = params.get("month") ?? "";
  const { articles, loading, error } = useArticles();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, slug, month]);
  const filtered = useMemo(
    () =>
      articles.filter(
        (a) =>
          (!slug || a.category === slug) &&
          (!month || a.published_at?.startsWith(month)) &&
          `${a.title} ${a.subtitle} ${a.article_tags?.map((t) => t.tag).join(" ")}`
            .toLocaleLowerCase()
            .includes(q.toLocaleLowerCase()),
      ),
    [articles, slug, q, month],
  );
  return (
    <main>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE SANN ARCHIVE</span>
          <h1>
            {categories.find((c) => c[0] === slug)?.[1] ??
              "Every story. One place."}
          </h1>
        </div>
      </div>
      <form className="search-form" onSubmit={(e) => e.preventDefault()}>
        <Search />
        <label className="sr-only" htmlFor="query">
          Search articles
        </label>
        <input
          id="query"
          value={q}
          placeholder="Search headlines, topics, and tags…"
          onChange={(e) => setParams({ q: e.target.value, month })}
        />
        <label htmlFor="month">Month</label>
        <input
          id="month"
          type="month"
          value={month}
          onChange={(e) => setParams({ q, month: e.target.value })}
        />
      </form>
      <p className="muted">{filtered.length} stories</p>
      <State loading={loading} error={error} empty={!filtered.length}>
        <div className="cards-grid">
          {filtered.slice(0, page * 12).map((a) => (
            <Card key={a.id} article={a} />
          ))}
        </div>
        {filtered.length > page * 12 && (
          <button className="button" onClick={() => setPage(page + 1)}>
            Load more stories
          </button>
        )}
      </State>
    </main>
  );
}
export function ArticlePage() {
  const { slug } = useParams();
  const { articles, loading, error } = useArticles();
  const a = articles.find((x) => x.slug === slug);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    document.title = a ? `${a.title} | SANN` : "Article | SANN";
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute("content", a?.subtitle ?? "San Andreas News Network");
    return () => {
      document.title = "SANN — San Andreas News Network";
    };
  }, [a]);
  return (
    <main>
      <State loading={loading} error={error} empty={!a}>
        {a && (
          <>
            <div className="article-heading">
              <Link className="eyebrow" to={`/category/${a.category}`}>
                {categories.find((x) => x[0] === a.category)?.[1]}
              </Link>
              <h1>{a.title}</h1>
              <p>{a.subtitle}</p>
              <div className="byline">
                <Avatar
                  url={a.profiles?.avatar ?? ""}
                  name={a.profiles?.rp_name ?? "SANN"}
                />
                <div>
                  <Link to={`/author/${a.author_id}`}>
                    <b>{a.profiles?.rp_name}</b>
                  </Link>
                  <small>
                    {date(a.published_at)} ·{" "}
                    {a.published_at &&
                      new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "America/Los_Angeles",
                        timeZoneName: "short",
                      }).format(new Date(a.published_at))}
                  </small>
                </div>
                <button
                  className="button subtle"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      setCopied("Link copied");
                    } catch {
                      setCopied("Copy the URL from your address bar");
                    }
                  }}
                >
                  <Copy size={16} />
                  {copied || "Copy link"}
                </button>
              </div>
            </div>
            <figure className="article-cover">
              <Image path={a.cover_path} alt={a.cover_caption} />
              <figcaption>{a.cover_caption}</figcaption>
            </figure>
            <div className="article-body">
              {a.is_demo && (
                <p className="notice">
                  Fictional GTA RolePlay sample. These are not real-world
                  events.
                </p>
              )}
              <RichBody node={a.content} />
              <div className="tags">
                {a.article_tags?.map((t) => (
                  <Link
                    key={t.tag}
                    to={`/archive?q=${encodeURIComponent(t.tag)}`}
                  >
                    {t.tag}
                  </Link>
                ))}
              </div>
              <div className="author-box">
                <Avatar
                  url={a.profiles?.avatar ?? ""}
                  name={a.profiles?.rp_name ?? "SANN"}
                />
                <div>
                  <Link to={`/author/${a.author_id}`}>
                    <b>{a.profiles?.rp_name}</b> ↗
                  </Link>
                  <p>{a.profiles?.biography}</p>
                </div>
              </div>
            </div>
            <section>
              <div className="section-title">
                <h2>Continue reading</h2>
              </div>
              <div className="cards-grid">
                {articles
                  .filter((x) => x.id !== a.id)
                  .sort(
                    (x, y) =>
                      Number(y.category === a.category) -
                      Number(x.category === a.category),
                  )
                  .slice(0, 3)
                  .map((x) => (
                    <Card key={x.id} article={x} />
                  ))}
              </div>
            </section>
          </>
        )}
      </State>
    </main>
  );
}
export function Author() {
  const { id } = useParams();
  const { articles, loading, error } = useArticles();
  const [profile, setProfile] = useState<Profile | null>(null),
    [profileError, setProfileError] = useState("");
  useEffect(() => {
    if (demo) {
      setProfile(id === demoProfile.id ? demoProfile : null);
      return;
    }
    db?.from("profiles")
      .select("*")
      .eq("id", id ?? "")
      .maybeSingle()
      .then(({ data, error }) => {
        setProfile(data);
        if (error) setProfileError(error.message);
      });
  }, [id]);
  return (
    <main>
      <State loading={loading} error={error || profileError} empty={!profile}>
        {profile && (
          <>
            <div className="profile-hero">
              <Avatar url={profile.avatar} name={profile.rp_name} />
              <span className="eyebrow">THE SANN NEWSROOM</span>
              <h1>{profile.rp_name}</h1>
              <p>
                {profile.position} · {profile.department}
              </p>
              <p>{profile.biography}</p>
              <small>On the desk since {date(profile.joined_at)}</small>
            </div>
            <div className="section-title">
              <h2>Published reporting</h2>
            </div>
            <div className="cards-grid">
              {articles
                .filter((a) => a.author_id === id)
                .map((a) => (
                  <Card key={a.id} article={a} />
                ))}
            </div>
          </>
        )}
      </State>
    </main>
  );
}
export function About() {
  const [text, setText] = useState(
    "An independent fictional news agency for one GTA RolePlay community. Our stories take place inside San Andreas.",
  );
  useEffect(() => {
    db?.from("site_settings")
      .select("value")
      .eq("key", "about")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setText(data.value);
      });
  }, []);
  return (
    <main className="about">
      <span className="eyebrow">OUR PURPOSE</span>
      <h1>
        Local stories.
        <br />
        Independent voices.
      </h1>
      <p className="intro">San Andreas News Network</p>
      <p>{text}</p>
      <div className="about-grid">
        <section>
          <h2>Reporting with care</h2>
          <p>
            We seek context, hear every side, and distinguish verified
            information from allegations. Corrections belong alongside our
            reporting.
          </p>
        </section>
        <section>
          <h2>A fictional world</h2>
          <p>
            SANN covers a single GTA RolePlay server. Names, events and
            organizations appear in an in-game context. This is not real-world
            news.
          </p>
        </section>
        <section>
          <h2>Our editorial desk</h2>
          <p>
            Junior correspondents work with editors before publication. Senior
            journalists report independently, with editorial oversight and a
            shared record of changes.
          </p>
          <Link to="/newsroom">Staff sign in →</Link>
        </section>
      </div>
    </main>
  );
}
