# Deployment record — 12 November 2026

- Public HTTPS preview: https://klissrrzxc.github.io/sann/
- Repository: https://github.com/klissrrzxc/sann
- Newsroom route: https://klissrrzxc.github.io/sann/#/newsroom
- Initial deployed application commit: `b0f22fd`
- Successful workflow: https://github.com/klissrrzxc/sann/actions/runs/43201215638
- GitHub Pages uses GitHub Actions. The owner explicitly approved public repository visibility.
- `VITE_DEMO_MODE=true` is configured as an Actions repository variable. The public page clearly labels the read-only fictional preview.

Verified after deployment: HTTPS index HTTP 200 with the SANN title; the referenced production JavaScript, CSS and favicon each return HTTP 200. GitHub Actions installation, typecheck, lint, 19 tests, build, artifact upload and Pages deploy all succeeded.

This does **not** establish a working cloud database or staff sign-in. Supabase migrations have not been applied to project `tjupwfuycqeplizcmibv`; no administrator has been created. Its MCP is configured locally but did not expose callable tools to this chat. The platform remains a preview until cloud setup and integration checks are complete.

The browser automation tool refused further Windows input because it could not reliably identify the active browser URL. Desktop/mobile appearance and end-to-end browser behavior have not been visually verified. See `VERIFICATION.md` for the exact scope of completed and remaining checks.

Next owner action: in the app's MCP settings, restart the saved Supabase server and authenticate if prompted, then continue the chat so the SQL tools can be detected. Official setup reference: https://learn.chatgpt.com/docs/extend/mcp?surface=app . No secret keys should be pasted into chat or the repository.
