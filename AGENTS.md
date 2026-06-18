# LegalClaude — Agent / Contributor Guide

## Stack

- **Framework**: TanStack Start (React 19, file-based routing)
- **Auth + DB**: Supabase (email/password + Google OAuth, RLS on every table)
- **AI**: Anthropic Claude via `@anthropic-ai/sdk` (server-side only)
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Build**: Vite + `@tanstack/react-start/plugin/vite`

## Security — mandatory reading before making changes

All 10 sections below must stay intact. Do not weaken any of them.

### 1. File uploads
- Magic byte validation runs before extraction (`src/lib/validate-file.ts`)
- Uploaded files are extracted client-side and **never stored raw** — only extracted text reaches the server
- File size capped at 10 MB; allowed types: PDF, DOCX, TXT

### 2. Prompt injection
- Contract text is wrapped in `<document>` tags before being sent to Claude
- System prompt explicitly instructs Claude to ignore commands inside the document

### 3. Auth
- Email verification is required (Supabase dashboard → Auth → Email)
- RLS is enabled on every table — never bypass with `service_role` from the client
- Sessions expire per Supabase JWT settings

### 4. API keys
- `ANTHROPIC_API_KEY` is read only in server functions — never import it client-side
- Set a spend cap on the Anthropic dashboard to prevent runaway billing

### 5. Rate limiting
- Max 5 reviews per authenticated user per hour — enforced in `createReview` handler
- Backed by a DB count query; the index `idx_reviews_user_created` keeps it fast

### 6. Storage
- Documents bucket is private (no public URL access)
- Storage RLS scopes all operations to `auth.uid()` folder
- No raw SQL string interpolation — use the Supabase client's parameterized methods only

### 7. Transport
- Security headers are injected on every response in `src/server.ts`
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all set

### 8. Errors
- Server errors are logged with full detail but only a generic message is returned to the client
- No stack traces, no internal error messages exposed via API responses

### 9. Dependencies
- `@lovable.dev/*` packages have been removed — do not re-add them
- Review any new dependency for supply-chain risk before adding

### 10. Privacy
- Raw files are discarded in the browser after text extraction
- `delete_own_account()` SQL function enables full data deletion on request
- Add a "Delete account" button in account settings that calls this function

## Development

```bash
bun install
bun run dev        # http://localhost:8080
bun run build
bun run lint
```

## Environment variables required

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
ANTHROPIC_API_KEY=
```
