# Token Lifecycle — Delta Spec (MODIFIED)

## MODIFIED: Token validation includes refresh-token lifecycle

The existing token validation logic (`src/services/token.ts`) MUST be extended to:
- Track refresh-token issuance timestamps alongside access-token timestamps
- Enforce a refresh-token TTL of 7 days (configurable via `TOKEN_REFRESH_TTL_DAYS` env var)
- Invalidate all refresh tokens on explicit logout

### Scenarios

- Refresh token within TTL → valid; issuance timestamp updated
- Refresh token beyond TTL → invalid; return `{ cliAvailable: false, error: "token_expired" }`

Implementation file: `src/services/token.ts`, `src/middleware/auth-guard.ts`
