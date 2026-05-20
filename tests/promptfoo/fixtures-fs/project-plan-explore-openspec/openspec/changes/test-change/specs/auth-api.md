# Auth API Delta Spec

## ADDED: Token validation endpoint

The service MUST expose `src/api/auth.ts` with a POST endpoint at `/auth/token`.

Implementation requires changes to `src/middleware/auth-guard.ts` and `src/routes/index.ts`.
