# San Andreas News Network (SANN)

A React/TypeScript editorial platform for one fictional GTA RolePlay server. English interface, Russian-language reporting. Vite, Tailwind CSS, Tiptap and Supabase (PostgreSQL, Auth, private Storage). Original SANN branding; the bundled preview illustrations are original SVG artwork, not photographs or GTA screenshots.

## Current delivery status

Source, SQL migrations, local PostgreSQL security tests and Pages deployment workflow are included. A production build is not proof of an operational cloud installation. A cloud project, invited administrator and successful Pages deployment are required before the platform can be used. See `VERIFICATION.md` for the verified state and remaining checks.

## Local development

Use Node.js 24 and pnpm 11.25.0 (the version used by CI).

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Fill the two public Supabase connection values, then:
pnpm dev
```

The development URL has the `/sann/` base. For a clearly labeled read-only fictional preview, set `VITE_DEMO_MODE=true`. Preview content is bundled only for public reading; it never simulates login, media uploads, article saves or staff statistics. Production should use `false`. No stories are written to localStorage. Supabase's standard Auth SDK persists and refreshes its own session token in browser storage.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm build` creates `dist/`. Dependencies are locked by `pnpm-lock.yaml`. esbuild is explicitly permitted to run its package installation script.

## Configure Supabase

1. Use a Supabase project you own. Review the additive migration before applying it to a project that already contains tables with the same names. It creates tables and enum types; it is intended for a clean app schema, not to overwrite an existing application.
2. In SQL Editor, execute `supabase/migrations/001_newsroom.sql` once. Alternatively, initialize/link the Supabase CLI for your project and use `supabase db push`.
3. In Authentication settings, **disable public signups**. Use email/password authentication and invitation-only staff onboarding. Configure SMTP for reliable invitations and recovery messages.
4. Set Auth Site URL to the deployed origin plus `/sann/`; add that exact URL and the local development URL to the allowed redirect URLs. Supabase consumes invitation/recovery tokens before the hash router starts; after accepting an invitation/recovery link, open Newsroom → Account Settings to set your password. This flow still requires cloud verification.
5. Put the project URL and **anon/publishable key** in `.env`. Never use a secret/service_role key in Vite variables, client code, repository variables or the browser.
6. Storage uses a private `newsroom` bucket, 5 MB limit, JPEG/PNG/WebP MIME allowlist. The browser validates and decodes images, resizes to 2400px and converts to WebP before upload. Signed download URLs expire in one hour; reload a long-open page if an image expires.

The migration uses RLS for reads and revokes direct application-table writes. Authenticated writes use named SQL functions with fixed `search_path`, role checks and server-side validation. Functions are explicitly revoked from PUBLIC and granted only to intended roles. Public profiles contain RP fields only; email addresses remain in Supabase Auth.

### First administrator

1. Through the project owner's Supabase Authentication dashboard, invite/create the intended owner account. The owner accepts their email invitation and chooses their own password.
2. Copy the user's UUID, replace the placeholder **locally** in `supabase/bootstrap-admin.sql`, and run it as the trusted project owner in SQL Editor. Do not commit personal values. It refuses to run when an administrator already exists.
3. Open `/sann/#/newsroom` and sign in with that account. There is no public bootstrap endpoint and no default admin password.

### Add staff

The owner invites a user through Supabase Authentication. An authenticated SANN administrator then enters that user's UUID and RP name in Newsroom → Administration and assigns a role. This deliberate two-step process avoids distributing a service_role key or exposing an unrestricted invitation endpoint. Deactivating staff blocks database writes immediately, even if their Auth session has not expired. Change roles through Administration; users cannot edit their own role directly.

## Editorial workflow

| Role | Database-enforced authority |
| --- | --- |
| Administrator | All stories, staff access, network settings, audit log |
| Editor-in-Chief | All stories, publication, requests for changes, homepage selection |
| Senior Journalist | Create, edit and publish own stories; use shared photographs |
| Junior Journalist | Create/edit own drafts or returned stories; submit for review |
| Photographer | Upload photographs and remove own unused assets |

Junior submissions lock while pending review. An editor can publish or return them with a required comment. A senior can publish their own work. The article editor includes draft saving, category, tags, subtitles, cover/caption, headings, emphasis, lists, quotes, inline images, preview and an unsaved-changes warning. Featured stories are controlled by editors through the article editor; the lead is the first featured published article in the feed.

`save_article` locks the row and checks the expected version. The entire story, tags, image references, review and audit event commit together. A stale save receives a conflict error; copy unsaved text before reloading and reconciling it. There is no silent last-write-wins overwrite. Content uses Tiptap JSON; the public renderer constructs whitelisted React elements and never injects HTML.

The Media Library is shared among active staff. Public visitors can retrieve only images referenced by published articles. Deletion reserves the asset under a row lock before the Storage API call; article saves reject reserved images. Referenced assets cannot be deleted, including references in drafts. If Storage deletion fails, the reserved asset remains visible in the library; its owner can retry deletion. An upload whose metadata registration fails is an orphan that the project owner must remove from Storage after checking references.

## Demo content

`VITE_DEMO_MODE=true` provides a labeled read-only public preview without a backend. Set it to `false` to read real database articles. Optionally execute `supabase/seed-demo.sql` after administrator bootstrap to insert fictional stories **into the real database**. These use `is_demo=true`, show a fictional-content notice and contain no third-party photographs. `supabase/remove-demo.sql` first lists the exact rows and contains an intentionally commented removal transaction for the owner to review. It does not delete genuine newsroom articles.

## GitHub Pages deployment

Repository: https://github.com/klissrrzxc/sann

1. Commit the source to `main`.
2. In Settings → Pages choose **GitHub Actions**. GitHub Pages for a private repository may require a paid GitHub plan; otherwise the owner must choose to make the repository public or use another host. Do not expose an existing private repository without reviewing its contents.
3. In Settings → Secrets and variables → Actions → **Variables**, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DEMO_MODE=false`. The first two are public connection configuration, protected by RLS; no service_role key belongs here.
4. Push to `main` or manually run the **Validate and deploy SANN** workflow. It installs locked dependencies, typechecks, lints, runs tests, builds, uploads the artifact and deploys with Pages OIDC. Pull requests run checks without deployment.
5. Inspect the resulting Actions run and visit the returned URL over HTTPS. The expected default address is `https://klissrrzxc.github.io/sann/`, but it must be verified after deployment.

Routing uses hash URLs, such as `/sann/#/article/story-UUID` and `/sann/#/newsroom`. This reliably supports reloads and direct links on GitHub Pages without a server rewrite. The application route is `/newsroom`; the hosted link includes `#/newsroom`. Do not remove `/sann/` from Vite's base setting.

### SEO limits

The index includes general description/Open Graph metadata and the reader updates the document title and description. GitHub Pages serves a client-rendered hash-routed application. Social crawlers generally do not render per-article metadata or distinct previews for these URLs; only the general SANN preview is available. Article-specific social cards and full search indexing require generated HTML pages/SSR on another hosting path and a publishing integration. This is an explicitly documented limitation, not an implemented feature.

## Troubleshooting

- **Database is not configured:** supply both Vite variables and rebuild. They are baked into the build, not read at runtime.
- **Empty feed:** publish an article or deliberately seed fictional stories. Empty database state is normal.
- **Permission denied:** confirm the authenticated user's active `staff_roles` record. A Supabase Auth account alone grants no newsroom role.
- **Junior cannot save pending story:** an editor must first return it for changes. This is enforced even through direct API calls.
- **Conflict:** another save changed the expected version. Copy your unsaved text, reload and reconcile.
- **Images missing:** check bucket policies, article image references, configuration and signed URL expiry. Never make the whole bucket public to hide policy errors.
- **Invitation/recovery redirects:** match the deployed `/sann/` URL exactly in Auth's allowed URLs. Use Account Settings to choose your password after accepting the link.
- **Pages 404:** check Pages is enabled, Actions succeeded, and the project path is `/sann/`. Article paths require the `#` segment.
- **Pages unavailable on private repository:** review the GitHub plan or ask the owner to choose repository visibility/hosting.

Local security tests run real SQL through PGlite with minimal Supabase Auth/Storage schema stubs. They do not verify the hosted Auth service, HTTP Storage API, actual SMTP, signed URL delivery, cloud RLS configuration or production browser behavior. These require the connected Supabase project and deployed application.

Official references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vite GitHub Pages deployment](https://vite.dev/guide/static-deploy#github-pages).
