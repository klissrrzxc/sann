# SANN verification — 12 November 2026

## Passed locally

- TypeScript strict typecheck, ESLint and Vite production build.
- 19 automated tests across UI permissions, safe structured rendering and PostgreSQL/RLS behavior.
- SQL migration executes on a local PostgreSQL engine (PGlite) with minimal Supabase auth/storage schema stubs.
- Junior publication blocked by RPC and direct table writes denied.
- Junior submission locks while pending; editor comment → resubmission → publication succeeds.
- Senior own-publication succeeds; foreign edits, photographer article writes and unapproved staff writes fail.
- Self-promotion and direct role writes blocked; administrator can assign staff and cannot revoke own administrator role.
- Stale version writes rejected; audit log private and append-only for application roles.
- Anonymous readers cannot see draft stories or unattached photographs.
- Published image references permit public reads; referenced/foreign media deletion blocked; reserved images cannot be attached.
- Deactivated staff immediately lose write authority.

## Deployment

GitHub repository `klissrrzxc/sann` was initially empty and private. The owner explicitly approved making it public. GitHub Pages was enabled with GitHub Actions after the plan rejected Pages on the private repository. The workflow is configured for a labeled, read-only preview (`VITE_DEMO_MODE=true`) until Supabase connection values and a trusted administrator are configured.

Final Actions/HTTP verification results are recorded in `DEPLOYMENT.md` when available.

## Not yet verified

- Cloud migration, hosted RLS configuration and real PostgreSQL API.
- Staff sign-in, invitation/password recovery, email delivery and administrator bootstrap.
- Actual Storage uploads, signed downloads and persistence through the hosted API.
- End-to-end editing/moderation with real accounts in each role.
- Browser navigation, keyboard interaction, rendered desktop/mobile layouts and direct-link reloads.

The Windows browser automation tool stopped because it could not confidently determine the active browser URL. No visual/browser pass is claimed. Supabase MCP appears in local configuration for project `tjupwfuycqeplizcmibv`, but its tools were not exposed to this chat during implementation. No cloud SQL execution or admin account creation is claimed.

## Before production use

Expose the connected Supabase MCP tools to this chat (a Codex reload/new turn may be required), apply the reviewed migration, disable public signups, configure Auth URLs/SMTP, invite the owner and run the protected bootstrap. Set public Supabase connection variables in GitHub Actions, set demo mode to false, redeploy and complete the real-account/browser checks above. No passwords or secret keys should be committed or pasted into the public repository.
