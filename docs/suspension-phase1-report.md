# Phase 1: Suspension / termination investigation (2026-06-25)

Answers to the eight questions in `cursor-prompt-suspension-termination-credits.md`:

1. **Account states on User:** None. No `AccountStatus`, suspension, or termination fields. No strike-based access blocking at request time.
2. **Permanent termination vs suspension:** Not distinct in code. Only hard delete via `deleteUserCompletely`.
3. **ModerationAppeal:** Model does not exist. No appeal resolution flow.
4. **Credits on suspend/ban:** No interaction; balance is untouched because no enforcement status exists.
5. **Voluntary deletion:** `DELETE /api/account` → `deleteUserCompletely` deletes all `CreditTransaction` rows with the user.
6. **Self-delete status check:** None. Any logged-in user can self-delete regardless of hypothetical status.
7. **Suspended user sign-in / appeal UI:** N/A — no suspension. Comment moderation is admin-only queues.
8. **ModerationLog detail:** Model does not exist. Comment flags do not write per-user strike history.

**Conclusion:** Proceed with Phase 2 — three-state model, ModerationLog/Appeal, credit forfeiture on termination, access gates, status pages, self-delete block, admin purge unchanged.
