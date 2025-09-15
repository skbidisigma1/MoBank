## MoBank LLM Guide

### Architecture
- Static HTML/CSS/JS + serverless API (`api/[...slug].js` dispatches to `routes/<name>.js`).
- Edge exception: `api/webhook.js` (no Node APIs) → Discord relay.
- Data: Firestore via `firebase.js`; direct `db.collection()` only.
- Auth: Auth0 RS256 JWT through `getTokenFromHeader` + `verifyToken` (never manual jwt.verify).

### Handler Skeleton
```js
if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
const token = getTokenFromHeader(req); if (!token) return res.status(401).json({ message: 'Unauthorized' });
let decoded; try { decoded = await verifyToken(token); } catch { return res.status(401).json({ message: 'Token verification failed' }); }
// validate req.body
// Firestore ops (transaction if balance changes)
return res.status(200).json({ message: 'Success' });
```
Admin check: `roles = decoded['https://mo-classroom.us/roles']||[]; if(!roles.includes('admin')) return res.status(403).json({ message:'Forbidden' });`

### Key Data
`users/{uid}`: `name, instrument, class_period, currency_balance, theme, transactions[], notifications[], metronomePresets[]`.
`aggregates/leaderboard_period_<n>`: `leaderboardData[], lastUpdated`.

### Mutation Rules
- Use Firestore transactions for any balance changes / multi-doc updates.
- Trim: transactions newest-first (limit 5–8); notifications newest-first (limit 10, sorted by timestamp).
- Recompute leaderboard after bulk or admin adjustments (see `adminAdjustBalance.js`).

### Business Logic
- No self-transfer; transfer amount > 0.
- Admin adjustments +/-; clamp final balance to ±100,000,000.
- Pluralization inline: `v === 1 ? 'MoBuck' : 'MoBucks'`.

### Infra / Security
- Rate limiting centralized (do not duplicate).
- CSP & headers in `vercel.json`; update if adding external origins.
- Edge webhook: keep lightweight; auth via static bearer; no Firestore.

### Optional Profiling
Reuse lightweight `profiler` (see `transferFunds.js`) if timing needed.

### Adding an Endpoint
1. Create `routes/<name>.js` using skeleton.
2. Validate early; return `{ message: '...' }` + data if needed.
3. For balance edits: transaction + trim arrays + leaderboard update if class-wide.

### Environment Variables
Auth0: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_WEBHOOK_TOKEN`.
Firebase: all `FIREBASE_*` creds.
Discord: `DISCORD_WEBHOOK_URL`.

### Avoid Adding (Premature)
Tests framework, bundlers, extra auth flows, generic error middleware.

### Consistency Cheatsheet
Early returns; stable filenames; minimal payloads; no raw error leaks (router already sanitizes).

Questions / edge cases: document here first, then implement.
