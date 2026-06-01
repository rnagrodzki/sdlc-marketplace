# Proposal: req-inventory-test

Add a session-refresh capability to the auth service. This change introduces a new
`POST /auth/refresh` endpoint (ADDED) and extends the existing token validation
logic to include refresh-token lifecycle handling (MODIFIED).

Scope: `src/api/auth.ts`, `src/services/token.ts`, `src/middleware/auth-guard.ts`.
