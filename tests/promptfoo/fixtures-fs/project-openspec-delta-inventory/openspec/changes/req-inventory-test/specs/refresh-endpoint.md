# Refresh Endpoint — Delta Spec (ADDED)

## ADDED: Session refresh endpoint

The service MUST expose `POST /auth/refresh` accepting `{ refreshToken: string }` in the
request body and returning `{ accessToken: string, expiresIn: number }` on success.

### Scenarios

- Valid refresh token → 200 with new access token and `expiresIn: 3600`
- Expired refresh token → 401 with `{ error: "token_expired" }`
- Malformed request body → 400 with `{ error: "invalid_request" }`

Implementation file: `src/api/auth.ts`
