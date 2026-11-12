# SANN verification — 12 November 2026

## Passed

- TypeScript strict typecheck, ESLint, Vite production build and 19 local automated tests.
- Cloud migration applied. RLS enabled on all 10 application tables. Supabase Security Advisor returned no findings.
- Real password sign-in succeeded for all five staff roles using disposable confirmed test accounts.
- Junior direct publication, foreign editing, self-promotion and unapproved article writes denied through real SQL/REST.
- Draft → review → request changes → resubmission → editor publication succeeded.
- Senior own-publication succeeded; published stories and authors loaded using a fresh anonymous HTTP client.
- Stale concurrent save rejected with HTTP 409. An initial integration failure exposed the need for PT409 instead of serialization SQLSTATE; the corrected full suite passed.
- Real private Storage upload, registration, published signed download and own-unused deletion succeeded. Private/foreign/referenced-image restrictions held.
- Deactivation denied writes despite an existing Auth session.
- Staff invitation endpoint rejected unauthenticated requests.
- All disposable Auth users, articles, images, profiles and test audit entries were removed. Independent SQL check confirmed zero remaining test accounts.
- The temporary integration endpoint was overwritten with an inert handler and JWT gateway verification enabled.
- Owner confirmed the Auth URL configuration; an HTTP redirect probe verified the SANN destination.

## Operational notes

The connected project is tjupwfuycqeplizcmibv. Only its public publishable key is used by the browser/Actions. Privileged implementations live in the non-exposed private schema; Data API wrappers are SECURITY INVOKER. The staff invitation service keeps service credentials in the Supabase runtime.

Performance Advisor reported informational unused-index notices on the newly created, initially empty tables. These indexes support the intended feed, author, media-reference and review queries and were retained.

The initial Windows-native browser attempt was blocked by URL detection. In-app browser access became available later; final browser observations and deployment are recorded in DEPLOYMENT.md. API tests alone do not prove complete responsive/accessibility behavior or email deliverability.
