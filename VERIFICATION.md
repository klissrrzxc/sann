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
- First owner account invited and assigned the active Administrator role. Owner invitation was accepted by Supabase for sending; inbox receipt and the owner's password selection remain the owner's actions.
- Browser: signed in with a disposable account, opened Dashboard, created a Tiptap draft, reloaded and verified the saved Russian text, published the story and loaded Administration with roles/settings/audit data.
- Browser: public articles and author details render; an article direct link survives reload; archive search filters six stories to the matching result; unauthenticated Newsroom access redirects to sign-in.
- Browser: mobile menu and public layouts checked at 390 px. Document width did not exceed viewport width. Temporary viewport override reset.
- All browser test records and the temporary test account were removed. The UI test endpoint was overwritten with an inert handler.

## Operational notes

The connected project is tjupwfuycqeplizcmibv. Only its public publishable key is used by the browser/Actions. Privileged implementations live in the non-exposed private schema; Data API wrappers are SECURITY INVOKER. The staff invitation service keeps service credentials in the Supabase runtime.

Performance Advisor reported informational unused-index notices on the newly created, initially empty tables. These indexes support the intended feed, author, media-reference and review queries and were retained.

The initial Windows-native browser attempt was blocked by URL detection. In-app browser access became available later and the browser checks above were completed. These targeted checks do not constitute a full WCAG audit or verify the owner's email inbox. The owner's password is never generated, read or reported by the assistant.
