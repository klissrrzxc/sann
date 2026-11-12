# Deployment — 12 November 2026

- Website: https://klissrrzxc.github.io/sann/
- Repository: https://github.com/klissrrzxc/sann
- Newsroom: https://klissrrzxc.github.io/sann/#/newsroom
- Supabase project: tjupwfuycqeplizcmibv
- GitHub Pages uses GitHub Actions; the owner approved public repository visibility.
- Public Supabase URL/publishable-key variables are configured. VITE_DEMO_MODE=false activates the real database.
- Schema, private Storage bucket and staff invitation Edge Function deployed. Cloud security and HTTP integration tests passed.

The first administrator was invited and assigned active access. The owner must accept their email invitation and set their own password in Account Settings; no shared/default password is created or reported.

The cloud-connected deployment passed GitHub Actions: https://github.com/klissrrzxc/sann/actions/runs/43204506579 . Real database articles, direct-link reloads, archive search, unauthorized redirects and the 390 px mobile layout were verified in the deployed browser. A separate disposable user also completed real browser sign-in, Tiptap draft creation, reload/persistence, publication and administration checks. All test accounts/articles were removed; only the owner's account and six clearly marked fictional seed stories remain. Temporary test/provisioning endpoints were disabled after use.

Supabase Security Advisor returned no findings. The final small editor fix suppresses an initial setEditable event so loading a saved article does not falsely mark it as unsaved. See VERIFICATION.md for the exact scope and owner-only onboarding steps.
