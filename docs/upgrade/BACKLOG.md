# Upgrade backlog

Out-of-scope items found during a phase. Logged, not fixed (operating rule 5).

| Found in | Severity | Item | Note |
|---|---|---|---|
| Phase 0 | P3 | Dead `apps/website/src/backend/` stub layer (`getDb()` throws) | Delete with `/api/products` |
| Phase 0 | P3 | `packages/types` has no tsconfig — not typechecked by turbo | |
| Phase 0 | P3 | `apps/dashboard/scripts/` excluded from typecheck | |
| Phase 0 | P3 | Legacy `.eslintrc.json` + `next lint` | Breaks on Next 16 / ESLint 10 |
| Phase 0 | P3 | 8 purpose-scoped internal keys all fall back to `INTERNAL_API_KEY` | |
| Phase 0 | P3 | Turnstile env vars documented, zero consumers | |
| Phase 0 | P3 | `.env.example` omits ~15 vars the code reads | |
| Phase 0 | P3 | HEAD on `/api/media/file/*` returns 404 while GET returns 200 | Breaks link checkers |
| Phase 0 | P3 | `return-requests.rmaNumber` not unique/required/generated | |
| Phase 0 | P3 | `team` / `clients` ignore their own `active` flag in read access | |
