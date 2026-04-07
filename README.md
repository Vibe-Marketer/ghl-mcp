# GHL MCP Server

A remote [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that gives AI agents full control over [GoHighLevel](https://www.gohighlevel.com/). Deployed as a Cloudflare Worker with user-key authentication, per-user scopes, multi-account support, and an admin panel.

**508 tools** across 18 domain modules covering the entire GHL API v2 surface + internal workflow builder API.

## What It Does

Connect any MCP-compatible AI client (Claude Code, Claude Desktop, Cursor, Windsurf, custom agents) to your GoHighLevel account. The AI can then manage your entire GHL workspace through natural language:

- *"Show me all appointments for this week"*
- *"Create a new contact named John Smith with email john@example.com"*
- *"Search my pipeline for deals over $5,000"*
- *"List all invoices from the last 30 days"*
- *"Build a workflow that triggers on form submission"*

## Setup Guide (Deploy Your Own)

### Prerequisites

- [Cloudflare Workers](https://workers.cloudflare.com/) account (free tier works)
- [Node.js](https://nodejs.org/) 18+
- A GHL account with API access (any paid plan)
- GHL OAuth app credentials (optional — for multi-location OAuth flow)

### Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd ghl-mcp
npm install
```

### Step 2: Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser for OAuth login. Alternatively, set a `CLOUDFLARE_API_TOKEN` env var with a token that has Workers, D1, KV, and Durable Objects permissions.

### Step 3: Configure Your Worker Name

Edit `wrangler.toml` and set:

```toml
name = "your-worker-name"    # This becomes your-worker-name.<subdomain>.workers.dev
```

Remove or replace the `account_id` line — Wrangler will auto-detect your account, or you can set it explicitly.

### Step 4: Create Cloudflare Resources

```bash
# Create the D1 database
npx wrangler d1 create ghl-accounts

# Create the KV namespace
npx wrangler kv namespace create OAUTH_KV
```

Copy the IDs from the output and update `wrangler.toml`:
- Replace `database_id` under `[[d1_databases]]` with your new D1 ID
- Replace `id` under `[[kv_namespaces]]` with your new KV ID

### Step 5: Run Database Migrations

```bash
npx wrangler d1 migrations apply ghl-accounts --remote
```

### Step 6: Set Secrets

```bash
# Required — pick your own values for these:
echo "your-admin-password" | npx wrangler secret put ADMIN_PASSWORD
echo "your-admin-pin" | npx wrangler secret put ADMIN_PIN

# Required — from your GHL OAuth app (or dummy values if using PITs only):
echo "your-ghl-client-id" | npx wrangler secret put GHL_CLIENT_ID
echo "your-ghl-client-secret" | npx wrangler secret put GHL_CLIENT_SECRET

# Optional — for workflow builder beta tools:
echo "your-firebase-token" | npx wrangler secret put GHL_FIREBASE_REFRESH_TOKEN
```

| Secret | Required | Purpose |
|--------|----------|---------|
| `ADMIN_PASSWORD` | Yes | Password for the `/admin` dashboard |
| `ADMIN_PIN` | Yes | PIN for API admin routes (`X-Admin-Pin` header) |
| `GHL_CLIENT_ID` | Yes* | GHL OAuth app Client ID |
| `GHL_CLIENT_SECRET` | Yes* | GHL OAuth app Client Secret |
| `GHL_FIREBASE_REFRESH_TOKEN` | No | Firebase refresh token (workflow builder BETA) |
| `ERROR_WEBHOOK_URL` | No | Webhook URL for error reports |

*If you only use Private Integration Tokens (no OAuth), set these to any placeholder value.

### Step 7: Deploy

```bash
npm run deploy
```

Or use the deploy script (runs duplicate checks + TypeScript validation first):

```bash
./scripts/deploy.sh
```

### Step 8: Verify

```bash
curl https://your-worker-name.your-subdomain.workers.dev/health
```

You should get: `{"status":"ok","server":"GoHighLevel MCP Server","version":"2.0.0"}`

### Step 9: Connect a GHL Location

**Option A — OAuth (recommended for multiple locations):**
1. Visit `https://your-worker.workers.dev/install` to get the OAuth URL
2. Open that URL — select the GHL location to install
3. Tokens auto-refresh (24h lifetime)

Note: Your GHL OAuth app's redirect URI must be set to `https://your-worker.workers.dev/callback`

**Option B — Private Integration Token (single location, no OAuth app needed):**
1. In GHL: Settings > Integrations > Private Integrations > Create
2. Copy the token
3. Add the location via the admin panel or the `ghl_add_sub_account` tool

### Step 10: Create a User and Connect

1. Go to `/signup` to register a user account
2. Approve the user in the `/admin` dashboard (login with your `ADMIN_PASSWORD`)
3. Connect your MCP client:

**Claude Code:**
```bash
claude mcp add --transport http \
  --header "X-User-Key: uk_YOUR_KEY_HERE" \
  ghl https://your-worker.workers.dev/mcp
```

**Claude Desktop / Cursor / Any MCP Client (`.mcp.json`):**
```json
{
  "mcpServers": {
    "ghl": {
      "type": "http",
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "X-User-Key": "uk_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Admin Dashboard

**URL:** `https://your-worker.workers.dev/admin`

The admin dashboard lets you:
- View, create, edit, and delete users
- Set per-user scopes (which of the 508 tools they can use)
- Set per-user account access (which GHL locations they can access)
- View and manage connected sub-accounts (OAuth + PIT)
- Scope picker with category presets (Full/Read-Only/None per domain)

Login requires the `ADMIN_PASSWORD` you set in Step 6.

## All Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/health` | GET | None | Health check — returns server name + version |
| `/mcp` | POST | `X-User-Key` header | MCP endpoint — all tool calls go here |
| `/signup` | GET/POST | None (rate limited) | Self-service user registration |
| `/admin` | GET | Password | Admin dashboard — manage users, accounts, scopes |
| `/install` | GET | None | Returns GHL OAuth install URL for adding locations |
| `/callback` | GET | None | OAuth callback — exchanges auth code for tokens |
| `/refresh` | POST | `X-Admin-Pin` header | Force-refresh all OAuth location tokens |
| `/admin/agency-token` | GET/POST | `X-Admin-Pin` header | View/store agency PIV token |
| `/authorize` | GET | PIN, session, or user key | OAuth auto-approve |
| `/register` | POST | PIN or user key | OAuth client registration |

## Architecture

```
MCP Client (Claude Code, Cursor, etc.)
  │
  │  HTTPS + X-User-Key header
  ▼
Cloudflare Worker (outer wrapper)
  │
  ├── Validates API key against D1 (SHA-256 hashed)
  ├── Stores auth context in KV (scopes + allowed accounts)
  ├── Passes user ID via URL query param
  │
  ▼
GHLMcpAgent (Durable Object)
  │
  ├── Reads auth from KV (scopes, allowed accounts)
  ├── Enforces per-tool scope checks (default-deny)
  ├── resolveClient() → picks correct GHL API key for the location
  │
  ▼
GoHighLevel REST API (services.leadconnectorhq.com)
```

## Authentication

### User-Key Auth (Primary — for MCP clients)

Every request to `/mcp` must include an API key:

```
Header: X-User-Key: uk_<uuid>
```

Keys are generated at `/signup` or by the admin. They are SHA-256 hashed before storage — the raw key is shown once and can never be recovered.

**User lifecycle:**
1. User registers at `/signup` → status = `pending`
2. Admin approves in admin panel → status = `active`
3. Admin can disable at any time → status = `disabled`

**Per-user access control:**
- **Scopes**: JSON array of tool names the user can call (e.g., `["ghl_get_contact", "ghl_send_message"]`), or `["*"]` for all 508 tools
- **Allowed Accounts**: JSON array of GHL location IDs the user can access, or `["*"]` for all

### GHL OAuth (for Adding Locations)

The OAuth install flow uses the GHL Marketplace. When you visit `/install`, the server constructs the OAuth URL using your deployed worker's origin as the callback — no hardcoded URLs.

This uses:
- **Client ID**: Set via `GHL_CLIENT_ID` secret
- **Client Secret**: Set via `GHL_CLIENT_SECRET` secret
- **Redirect URI**: Automatically set to `https://<your-worker>/callback`

### Private Integration Tokens (PITs)

For locations that don't use OAuth, add them manually with a GHL Private Integration Token. PITs don't expire but also can't auto-refresh. OAuth tokens are preferred for production use.

## Tool Domains (508 Tools)

| Domain | Tools | What It Covers |
|--------|-------|---------------|
| **accounts** | 5 | Sub-account management (add, list, switch, remove) |
| **ai-agents** | 26 | Voice AI, Conversation AI, Agent Studio, call logs |
| **automation** | 11 | Workflows, forms, surveys |
| **businesses** | 5 | Business CRUD |
| **calendars** | 56 | Calendars, appointments, groups, resources, services, bookings |
| **contacts** | 27 | Contacts, notes, tasks, tags, followers, merge |
| **content** | 41 | Blogs, media, documents, menus, snapshots, templates |
| **conversations** | 22 | Messages, calls, transcriptions, attachments |
| **errors** | 2 | View and clear server error logs |
| **knowledge-base** | 14 | Knowledge bases, FAQs, web crawlers |
| **locations** | 45 | Locations, users, custom fields, tags, business profiles |
| **marketing** | 70 | Social media, email campaigns, funnels, links, queues |
| **marketplace** | 9 | App installations, billing, rebilling |
| **misc** | 66 | Companies, phone numbers, products, custom objects, brands |
| **opportunities** | 12 | Deals, pipelines, followers |
| **payments** | 68 | Invoices, orders, subscriptions, estimates, coupons, shipping |
| **saas** | 13 | SaaS rebilling, subscriptions, agency plans, wallets |
| **workflow-builder** | 16 | Workflow CRUD, triggers, steps, publish/draft (BETA) |

## Sub-Account Management

The server supports multiple GHL locations (sub-accounts). Each has its own API key stored in D1.

**Resolution order** (when a tool is called):
1. If `locationId` is passed in the tool args → use that location's key from D1
2. If no `locationId` → use the default account from D1
3. If no default in D1 → fall back to `GHL_API_KEY` + `GHL_LOCATION_ID` env vars

**Token types:**
- **OAuth tokens**: Have `refresh_token` + `expires_at`. Auto-refresh before expiry.
- **Private Integration tokens**: Static, never expire, no refresh needed.

## Security

| Protection | How |
|-----------|-----|
| **API key hashing** | SHA-256 hash stored in D1 — raw key never persisted |
| **Per-user scopes** | Default-deny: no scopes = no tools. Admin must grant access |
| **Account isolation** | Users can only access GHL locations in their `allowed_accounts` |
| **Rate limiting** | 120 req/min on `/mcp`, 5 req/min on `/signup` |
| **Header sanitization** | Incoming `X-User-Scopes`, `X-User-Allowed-Accounts` stripped to prevent spoofing |
| **Timing-safe auth** | Admin PIN uses HMAC-SHA256 constant-time comparison |
| **Session fingerprinting** | Admin sessions bound to IP + User-Agent |
| **Error redaction** | API keys, tokens, passwords masked in all error logs |
| **CORS** | Admin routes restricted to same-origin; public routes use wildcard |
| **Security headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` |

## Costs

| Resource | Free Tier | Paid |
|----------|-----------|------|
| Workers requests | 100K/day | $0.30/M |
| Durable Objects | — | $0.15/M requests |
| D1 reads | 5M/day | $0.001/M rows |
| KV reads | 100K/day | $0.50/M reads |

For personal/small team use, this typically stays within free tier limits.

## Adding New Tools

### Add a tool to an existing domain

```bash
./scripts/add-tool.sh contacts ghl_archive_contact
```

### Add a new domain

```bash
./scripts/add-domain.sh new-domain
```

## License

[Apache 2.0](LICENSE)
