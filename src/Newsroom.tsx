import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useAuth } from "./auth";
import {
  db,
  demo,
  listArticles,
  removeImage,
  requireDb,
  uploadImage,
} from "./api";
import { Avatar, date, Image, State } from "./components";
import {
  canEdit,
  isEditor,
  label,
  roles,
  type Article,
  type Profile,
  type Role,
} from "./types";
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Unable to complete this action";
export function Login() {
  const { session, role, loading, error: authError } = useAuth();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await requireDb().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <State loading>{null}</State>;
  if (session && role) return <Navigate to="/newsroom" replace />;
  return (
    <main className="login">
      <div>
        <span className="eyebrow">STAFF ACCESS</span>
        <h1>
          Behind every story,
          <br />a newsroom.
        </h1>
        <p>
          Welcome to the San Andreas News Network editorial desk. Sign in with
          your staff account.
        </p>
        <span className="large-mark">
          SANN<span>■</span>
        </span>
      </div>
      <form onSubmit={submit}>
        <h2>Newsroom sign in</h2>
        <p className="muted">Invitation-only access for SANN staff.</p>
        {(!db || demo) && (
          <p className="notice">
            {!db
              ? "Supabase is not configured. Staff sign-in is unavailable."
              : "Public preview mode is enabled. Staff actions still use the real database."}
          </p>
        )}
        {session && !role && (
          <p className="notice error">
            Your account has no active staff assignment. Contact the
            administrator.
          </p>
        )}
        {(error || authError) && (
          <p role="alert" className="error">
            {error || authError}
          </p>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button disabled={busy || !db} className="button red-button">
          {busy ? "Signing in…" : "Sign in"} <ArrowUpRight size={16} />
        </button>
        <button
          type="button"
          className="text-link"
          disabled={!db || busy}
          onClick={async () => {
            setError("");
            if (!email) {
              setError("Enter your email address first.");
              return;
            }
            setBusy(true);
            try {
              const { error } = await requireDb().auth.resetPasswordForEmail(
                email,
                { redirectTo: `${location.origin}${import.meta.env.BASE_URL}` },
              );
              if (error) throw error;
              setNotice(
                "If the account exists, a recovery email has been requested. Follow it, then open Account Settings to choose a password.",
              );
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Forgot your password?
        </button>
        {notice && <p role="status">{notice}</p>}
        {session && (
          <button type="button" onClick={() => void db?.auth.signOut()}>
            Sign out current account
          </button>
        )}
      </form>
    </main>
  );
}
export function NewsroomLayout() {
  const { session, role, profile, loading, error } = useAuth();
  const [signoutError, setSignoutError] = useState("");
  if (loading) return <State loading>{null}</State>;
  if (error) return <State error={error}>{null}</State>;
  if (!session || !role) return <Navigate to="/login" replace />;
  const writer = role !== "photographer";
  return (
    <div className="newsroom">
      <aside className="newsroom-sidebar">
        <span className="eyebrow">EDITORIAL WORKSPACE</span>
        <h2>
          Newsroom<span className="red">.</span>
        </h2>
        <div className="staff-badge">
          <Avatar
            url={profile?.avatar ?? ""}
            name={profile?.rp_name ?? "Staff"}
          />
          <div>
            <b>{profile?.rp_name}</b>
            <small>{label(role)}</small>
          </div>
        </div>
        <NavLink end to="/newsroom">
          <LayoutDashboard size={17} />
          Dashboard
        </NavLink>
        {writer && (
          <>
            <NavLink to="/newsroom/articles">
              <FileText size={17} />
              My Articles
            </NavLink>
            <NavLink to="/newsroom/create">
              <Plus size={17} />
              Create Article
            </NavLink>
            <NavLink to="/newsroom/drafts">Drafts</NavLink>
            <NavLink to="/newsroom/pending">Pending Review</NavLink>
            <NavLink to="/newsroom/published">Published Articles</NavLink>
          </>
        )}
        <NavLink to="/newsroom/media">
          <ImageIcon size={17} />
          Media Library
        </NavLink>
        <NavLink to="/newsroom/staff">
          <Users size={17} />
          Staff Directory
        </NavLink>
        <NavLink to="/newsroom/settings">
          <Settings size={17} />
          Account Settings
        </NavLink>
        {role === "administrator" && (
          <NavLink to="/newsroom/admin">
            <Shield size={17} />
            Administration
          </NavLink>
        )}
        <button
          onClick={async () => {
            const result = await db!.auth.signOut();
            if (result.error) setSignoutError(result.error.message);
          }}
        >
          <LogOut size={17} />
          Sign out
        </button>
        {signoutError && <p role="alert">{signoutError}</p>}
      </aside>
      <div className="newsroom-content">
        <Outlet />
      </div>
    </div>
  );
}
export function useDeskArticles() {
  const [articles, setArticles] = useState<Article[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    listArticles(false)
      .then(setArticles)
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(refresh, [refresh]);
  return { articles, loading, error, refresh };
}
export function Dashboard() {
  const { articles, loading, error } = useDeskArticles();
  const { role } = useAuth();
  const [activity, setActivity] = useState<
    { id: number; to_status: string; created_at: string; comment: string }[]
  >([]);
  const [activityError, setActivityError] = useState("");
  useEffect(() => {
    db?.from("editorial_reviews")
      .select("id,to_status,created_at,comment")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, error }) => {
        if (error) setActivityError(error.message);
        else setActivity(data ?? []);
      });
  }, []);
  return (
    <>
      <DeskHeading
        title="The editorial desk"
        subtitle="Your reporting, in focus."
      />
      {role !== "photographer" && (
        <Link to="/newsroom/create" className="button red-button">
          <Plus size={16} />
          Create a story
        </Link>
      )}
      <State loading={loading} error={error}>
        <div className="stats">
          {[
            ["Published", "published"],
            ["Drafts", "draft"],
            ["Awaiting review", "pending_review"],
            ["Changes requested", "changes_requested"],
          ].map(([title, status]) => (
            <div key={status}>
              <span>{title}</span>
              <strong>
                {articles.filter((a) => a.status === status).length}
              </strong>
            </div>
          ))}
        </div>
        <p className="muted">Counts reflect articles available to your role.</p>
        <div className="section-title">
          <h2>Recent editorial activity</h2>
        </div>
        {activityError && (
          <p role="alert" className="error">
            {activityError}
          </p>
        )}
        {activity.length ? (
          activity.map((a) => (
            <div className="activity" key={a.id}>
              <span className="status">{label(a.to_status)}</span>
              <span>{a.comment || "Editorial status updated"}</span>
              <small>{date(a.created_at)}</small>
            </div>
          ))
        ) : (
          <p>No editorial activity yet.</p>
        )}
        <div className="section-title">
          <h2>Recently updated stories</h2>
        </div>
        <ArticleTable
          articles={[...articles]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, 5)}
        />
      </State>
    </>
  );
}
export function DeskHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="desk-heading">
      <span className="eyebrow">SAN ANDREAS NEWS NETWORK</span>
      <h1>
        {title}
        <span className="red">.</span>
      </h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
function ArticleTable({ articles }: { articles: Article[] }) {
  const { role, session } = useAuth();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Story</th>
            <th>Status</th>
            <th>Author</th>
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id}>
              <td>
                <b>{a.title}</b>
                <small>{label(a.category.replaceAll("-", "_"))}</small>
              </td>
              <td>
                <span className={`status ${a.status}`}>{label(a.status)}</span>
              </td>
              <td>{a.profiles?.rp_name}</td>
              <td>{date(a.updated_at)}</td>
              <td>
                <Link to={`/newsroom/edit/${a.id}`}>
                  {canEdit(role, session?.user.id ?? "", a) ? "Edit" : "View"} →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!articles.length && <p className="notice">No stories in this view.</p>}
    </div>
  );
}
export function DeskArticles() {
  const { articles, loading, error } = useDeskArticles();
  const { session } = useAuth();
  const { pathname } = useLocation();
  const section = pathname.split("/").at(-1);
  const filtered = articles.filter((a) =>
    section === "articles"
      ? a.author_id === session?.user.id
      : section === "drafts"
        ? ["draft", "changes_requested"].includes(a.status)
        : section === "pending"
          ? a.status === "pending_review"
          : a.status === "published",
  );
  return (
    <>
      <DeskHeading
        title={
          section === "articles"
            ? "My Articles"
            : section === "pending"
              ? "Pending Review"
              : label(section ?? "Articles")
        }
      />
      <State loading={loading} error={error}>
        <ArticleTable articles={filtered} />
      </State>
    </>
  );
}
export interface MediaAsset {
  path: string;
  owner_id: string;
  caption: string;
  created_at: string;
}
export function MediaLibrary({
  onSelect,
}: {
  onSelect?: (asset: MediaAsset) => void;
}) {
  const { session } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [caption, setCaption] = useState("");
  const refresh = useCallback(() => {
    setLoading(true);
    db?.from("media_assets")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setAssets(data ?? []);
        setLoading(false);
      });
  }, []);
  useEffect(refresh, [refresh]);
  return (
    <>
      <DeskHeading
        title="Media Library"
        subtitle="Shared photographs. Original perspectives."
      />
      <label>
        Photo caption
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={1000}
        />
      </label>
      <label className="upload-area">
        {busy
          ? "Processing image…"
          : "Upload a photograph — JPEG, PNG or WebP, up to 20 MB"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !session) return;
            setBusy(true);
            setError("");
            try {
              await uploadImage(file, caption, session.user.id);
              setCaption("");
              refresh();
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p className="muted">
        Images are resized to 2400 pixels, compressed to WebP and stored
        privately. Referenced photographs cannot be deleted.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <State loading={loading}>
        <div className="media-grid">
          {assets.map((a) => (
            <div className="media-card" key={a.path}>
              <Image path={a.path} alt={a.caption} />
              <p>{a.caption || "Untitled photograph"}</p>
              <small>{date(a.created_at)}</small>
              <div>
                {onSelect && (
                  <button className="button" onClick={() => onSelect(a)}>
                    Use photograph
                  </button>
                )}
                {a.owner_id === session?.user.id && (
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Delete this unused photograph permanently?",
                        )
                      )
                        return;
                      setBusy(true);
                      setError("");
                      try {
                        await removeImage(a.path);
                        refresh();
                      } catch (e) {
                        setError(message(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Delete unused
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!assets.length && (
          <p className="notice">
            Your next story needs a photograph. Upload the first one.
          </p>
        )}
      </State>
    </>
  );
}
export function Staff() {
  const [staff, setStaff] = useState<Profile[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    db?.from("profiles")
      .select("*")
      .order("rp_name")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setStaff(data ?? []);
      });
  }, []);
  return (
    <>
      <DeskHeading title="Staff Directory" />
      <State error={error}>
        <div className="cards-grid">
          {staff.map((p) => (
            <article className="staff-card" key={p.id}>
              <Avatar url={p.avatar} name={p.rp_name} />
              <h2>{p.rp_name}</h2>
              <p>
                {p.position} · {p.department}
              </p>
              <Link to={`/author/${p.id}`}>Public profile ↗</Link>
            </article>
          ))}
        </div>
      </State>
    </>
  );
}
function ActionForm({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      className="action-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setFeedback("");
        setError("");
        try {
          await onSubmit();
          setFeedback("Changes saved.");
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <button className="button red-button" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
      {feedback && <p role="status">{feedback}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
export function Account() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.rp_name ?? ""),
    [bio, setBio] = useState(profile?.biography ?? ""),
    [dept, setDept] = useState(profile?.department ?? ""),
    [avatar, setAvatar] = useState(profile?.avatar ?? ""),
    [password, setPassword] = useState("");
  return (
    <>
      <DeskHeading title="Account Settings" />
      <ActionForm
        onSubmit={async () => {
          const { error } = await requireDb().rpc("update_profile", {
            p_name: name,
            p_bio: bio,
            p_department: dept,
            p_avatar: avatar,
          });
          if (error) throw error;
        }}
      >
        <h2>Your public profile</h2>
        <label>
          RP Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </label>
        <label>
          Biography
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={5000}
          />
        </label>
        <label>
          Department
          <input
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            maxLength={100}
          />
        </label>
        <label>
          Avatar URL (HTTPS)
          <input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            pattern="https://.*"
          />
        </label>
      </ActionForm>
      <ActionForm
        onSubmit={async () => {
          const { error } = await requireDb().auth.updateUser({ password });
          if (error) throw error;
          setPassword("");
        }}
      >
        <h2>Set a new password</h2>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      </ActionForm>
    </>
  );
}
export function Administration() {
  const { role } = useAuth();
  const [staff, setStaff] = useState<
      (Profile & { staff_roles: { role: Role; active: boolean } })[]
    >([]),
    [uid, setUid] = useState(""),
    [name, setName] = useState(""),
    [assigned, setAssigned] = useState<Role>("junior_journalist"),
    [active, setActive] = useState(true),
    [logs, setLogs] = useState<
      { id: number; action: string; actor_id: string; created_at: string }[]
    >([]),
    [error, setError] = useState(""),
    [about, setAbout] = useState(""),
    [tagline, setTagline] = useState("");
  const refresh = useCallback(() => {
    if (role !== "administrator") return;
    Promise.all([
      requireDb().from("profiles").select("*,staff_roles(role,active)"),
      requireDb()
        .from("audit_logs")
        .select("id,action,actor_id,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      requireDb().from("site_settings").select("*"),
    ]).then(([s, l, settings]) => {
      if (s.error || l.error || settings.error) {
        setError((s.error || l.error || settings.error)!.message);
        return;
      }
      setStaff(s.data as typeof staff);
      setLogs(l.data ?? []);
      setAbout(settings.data?.find((x) => x.key === "about")?.value ?? "");
      setTagline(settings.data?.find((x) => x.key === "tagline")?.value ?? "");
    });
  }, [role]);
  useEffect(refresh, [refresh]);
  if (role !== "administrator")
    return <p role="alert">Administrator access required.</p>;
  return (
    <>
      <DeskHeading title="Administration" />
      {error && <p className="error">{error}</p>}
      <ActionForm
        onSubmit={async () => {
          const { error } = await requireDb().rpc("admin_staff", {
            p_user_id: uid,
            p_name: name,
            p_role: assigned,
            p_active: active,
          });
          if (error) throw error;
          refresh();
        }}
      >
        <h2>Staff access</h2>
        <p>
          Invite the employee through Supabase Authentication first, then assign
          their user UUID here. No public registration is provided.
        </p>
        <label>
          Existing staff
          <select
            value={uid}
            onChange={(e) => {
              const s = staff.find((p) => p.id === e.target.value);
              setUid(e.target.value);
              setName(s?.rp_name ?? "");
              setAssigned(s?.staff_roles.role ?? "junior_journalist");
              setActive(s?.staff_roles.active ?? true);
            }}
          >
            <option value="">Add invited employee…</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rp_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Invited user UUID
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            required
            pattern="[a-fA-F0-9-]{36}"
          />
        </label>
        <label>
          RP Name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Role
          <select
            value={assigned}
            onChange={(e) => setAssigned(e.target.value as Role)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active staff access
        </label>
      </ActionForm>
      <ActionForm
        onSubmit={async () => {
          for (const [key, value] of [
            ["about", about],
            ["tagline", tagline],
          ]) {
            const { error } = await requireDb().rpc("update_setting", {
              p_key: key,
              p_value: value,
            });
            if (error) throw error;
          }
          refresh();
        }}
      >
        <h2>Network settings</h2>
        <label>
          Tagline
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </label>
        <label>
          About the network
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} />
        </label>
      </ActionForm>
      <div className="section-title">
        <h2>Audit log</h2>
      </div>
      <p className="muted">
        Latest 50 critical actions, recorded by the database.
      </p>
      {logs.map((l) => (
        <div key={l.id} className="activity">
          <b>{l.action}</b>
          <small>
            {l.actor_id} · {date(l.created_at)}
          </small>
        </div>
      ))}
    </>
  );
}
export function EditorialSettings() {
  const { role } = useAuth();
  return isEditor(role) ? (
    <Link to="/newsroom/articles">
      Manage featured stories in the article editor →
    </Link>
  ) : null;
}
