# DLF Agency MCP Server

A remote [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that gives AI agents full control over [GoHighLevel](https://www.gohighlevel.com/). Deployed as a Cloudflare Worker with user-key authentication, per-user scopes, multi-account support, and an admin panel.

**508 tools** across 18 domain modules covering the entire GHL API v2 surface + internal workflow builder API.

**Live at:** `https://dlf-agency.skool-203.workers.dev`

## What It Does

Connect any MCP-compatible AI client (Claude Code, Claude Desktop, Cursor, Windsurf, custom agents) to your GoHighLevel account. The AI can then manage your entire GHL workspace through natural language:

- *"Show me all appointments for this week"*
- *"Create a new contact named John Smith with email john@example.com"*
- *"Search my pipeline for deals over $5,000"*
- *"Create a Conversation AI agent for SMS auto-replies"*
- *"List all invoices from the last 30 days"*
- *"Build a workflow that triggers on form submission"*

## Quick Start (Connecting as a User)

### 1. Get Your API Key

Go to `https://dlf-agency.skool-203.workers.dev/signup` and register. Your key (`uk_...`) is shown **once** -- copy it immediately. An admin must approve your account before it works.

### 2. Connect Your MCP Client

**Claude Code:**
```bash
claude mcp add --transport http \
  --header "X-User-Key: uk_YOUR_KEY_HERE" \
  dlf-agency https://dlf-agency.skool-203.workers.dev/mcp
```

**Claude Desktop / Cursor / Any MCP Client (`.mcp.json`):**
```json
{
  "mcpServers": {
    "dlf-agency": {
      "type": "http",
      "url": "https://dlf-agency.skool-203.workers.dev/mcp",
      "headers": {
        "X-User-Key": "uk_YOUR_KEY_HERE"
      }
    }
  }
}
```

### 3. Start Using It

Once connected, ask your AI to do anything in GHL:
```
"List all contacts tagged 'hot-lead'"
"Send an SMS to contact ID xyz saying 'Hey, following up on our call'"
"Create a calendar event for tomorrow at 2pm"
```

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

### Why KV for Auth?

The MCP SDK's `McpAgent.serve()` internally creates a WebSocket upgrade request that strips all custom headers. Only `x-partykit-room` (session ID) and `Upgrade` survive. So we store auth context in KV keyed by user ID, and the Durable Object reads it from there.

## All Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/health` | GET | None | Health check -- returns server name + version |
| `/mcp` | POST | `X-User-Key` header | MCP endpoint -- all tool calls go here |
| `/signup` | GET/POST | None (rate limited) | Self-service user registration |
| `/admin` | GET | Password | Admin panel -- manage users, accounts, scopes |
| `/install` | GET | None | Returns GHL OAuth install URL for adding locations |
| `/callback` | GET | None | OAuth callback -- exchanges auth code for tokens |
| `/refresh` | POST | `X-Admin-Pin` header | Force-refresh all OAuth location tokens |
| `/admin/agency-token` | GET/POST | `X-Admin-Pin` header | View/store agency PIV token |
| `/authorize` | GET | PIN, session, or user key | OAuth auto-approve |
| `/register` | POST | PIN or user key | OAuth client registration |

## Authentication

### User-Key Auth (Primary -- for MCP clients)

Every request to `/mcp` must include an API key:

```
Header: X-User-Key: uk_58894012-805b-4081-89c8-2ad0391e6c2b
```

Keys are generated at `/signup` or by the admin. They are SHA-256 hashed before storage -- the raw key is shown once and can never be recovered.

**User lifecycle:**
1. User registers at `/signup` -> status = `pending`
2. Admin approves in admin panel -> status = `active`
3. Admin can disable at any time -> status = `disabled`

**Per-user access control:**
- **Scopes**: JSON array of tool names the user can call (e.g., `["ghl_get_contact", "ghl_send_message"]`), or `["*"]` for all 508 tools
- **Allowed Accounts**: JSON array of GHL location IDs the user can access (e.g., `["W7BRJwzJCvFs9r0xZHrE"]`), or `["*"]` for all

### GHL OAuth (for Adding Locations)

To connect a new GHL location (sub-account):

1. Visit `GET /install` -- returns the GHL OAuth chooselocation URL
2. Open that URL in a browser -- select the GHL location to install
3. GHL redirects to `/callback?code=xxx`
4. Server exchanges the code for access + refresh tokens
5. Tokens are stored in D1 with the location ID
6. Tokens auto-refresh when they expire (24h lifetime)

This uses the GHL Marketplace OAuth flow with these credentials:
- **Client ID**: Set via `GHL_CLIENT_ID` secret
- **Client Secret**: Set via `GHL_CLIENT_SECRET` secret
- **Redirect URI**: `https://dlf-agency.skool-203.workers.dev/callback`

### Private Integration Tokens (PITs)

For locations that don't use OAuth, you can manually add them with a GHL Private Integration Token:

1. In GHL: Settings > Integrations > Private Integrations > Create
2. Copy the token
3. Use the `ghl_add_sub_account` tool or the admin panel to add the location with its PIT

PITs don't expire but also can't auto-refresh. OAuth tokens are preferred.

## Admin Panel

**URL:** `https://dlf-agency.skool-203.workers.dev/admin`

Features:
- View, create, edit, and delete users
- Set per-user scopes (which tools they can use)
- Set per-user account access (which GHL locations they can access)
- View and manage sub-accounts
- Scope picker with category presets (Full/Read-Only/None)

Login requires the `ADMIN_PASSWORD` secret.

## Tool Domains (508 Tools)

| Domain | Tools | File | What It Covers |
|--------|-------|------|---------------|
| **accounts** | 5 | `accounts.ts` | Sub-account management (add, list, switch, remove) |
| **ai-agents** | 26 | `ai-agents.ts` | Voice AI, Conversation AI, Agent Studio, call logs |
| **automation** | 11 | `automation.ts` | Workflows, forms, surveys |
| **businesses** | 5 | `businesses.ts` | Business CRUD |
| **calendars** | 56 | `calendars.ts` | Calendars, appointments, groups, resources, services, bookings |
| **contacts** | 27 | `contacts.ts` | Contacts, notes, tasks, tags, followers, merge |
| **content** | 41 | `content.ts` | Blogs, media, documents, menus, snapshots, templates |
| **conversations** | 22 | `conversations.ts` | Messages, calls, transcriptions, attachments |
| **errors** | 2 | `errors.ts` | View and clear server error logs |
| **knowledge-base** | 14 | `knowledge-base.ts` | Knowledge bases, FAQs, web crawlers |
| **locations** | 45 | `locations.ts` | Locations, users, custom fields, tags, business profiles |
| **marketing** | 70 | `marketing.ts` | Social media, email campaigns, funnels, links, queues |
| **marketplace** | 9 | `marketplace.ts` | App installations, billing, rebilling |
| **misc** | 66 | `misc.ts` | Companies, phone numbers, products, custom objects, brands |
| **opportunities** | 12 | `opportunities.ts` | Deals, pipelines, followers |
| **payments** | 68 | `payments.ts` | Invoices, orders, subscriptions, estimates, coupons, shipping |
| **saas** | 13 | `saas.ts` | SaaS rebilling, subscriptions, agency plans, wallets |
| **workflow-builder** | 16 | `workflow-builder.ts` | Workflow CRUD, triggers, steps, publish/draft (BETA) |

### Beta: Workflow Builder (16 tools)

The workflow builder tools use an **internal GHL API** (`backend.leadconnectorhq.com`) with Firebase authentication. These are not part of the official GHL REST API and may change without notice.

Tools: `ghl_workflow_builder_list`, `ghl_workflow_builder_create`, `ghl_workflow_builder_get`, `ghl_workflow_builder_get_steps`, `ghl_workflow_builder_get_triggers`, `ghl_workflow_builder_update`, `ghl_workflow_builder_save_steps`, `ghl_workflow_builder_publish`, `ghl_workflow_builder_draft`, `ghl_workflow_builder_delete`, `ghl_workflow_builder_create_trigger`, `ghl_workflow_builder_update_trigger`, `ghl_workflow_builder_delete_trigger`, `ghl_workflow_builder_create_folder`, `ghl_workflow_builder_clone`, `ghl_workflow_builder_error_count`

**Status:** Beta. These tools may not work reliably for create/update operations. Read operations (list, get) are stable.

Requires `GHL_FIREBASE_REFRESH_TOKEN` secret to be set.

### Disabled: Pipeline Write Operations

Three pipeline tools are disabled because GHL returns 401 for all token types:

- `ghl_create_pipeline` -- disabled
- `ghl_update_pipeline` -- disabled
- `ghl_delete_pipeline` -- disabled

Reading pipelines (`ghl_list_pipelines`, `ghl_get_pipeline`) works fine. The write operations require a separate `opportunities.pipeline.write` scope that GHL doesn't currently expose in Private Integration or OAuth token grants.

Code is preserved in `src/tools/_disabled/pipeline-write.ts` and can be re-enabled when GHL fixes this.

## Sub-Account Management

The server supports multiple GHL locations (sub-accounts). Each has its own API key stored in D1.

**Resolution order** (when a tool is called):
1. If `locationId` is passed in the tool args -> use that location's key from D1
2. If no `locationId` -> use the default account from D1
3. If no default in D1 -> fall back to `GHL_API_KEY` + `GHL_LOCATION_ID` env vars

**Token types:**
- **OAuth tokens**: Have `refresh_token` + `expires_at`. Auto-refresh before expiry.
- **Private Integration tokens**: Static, never expire, no refresh needed.

## Project Structure

```
dlf-ghl-mcp-server/
├── src/
│   ├── index.ts                    # Worker entry: auth wrapper + GHLMcpAgent DO
│   ├── types.ts                    # Env, User, SubAccount, ApiVersion types
│   ├── config.ts                   # API base URL, versions, MCP server metadata
│   │
│   ├── client/                     # GHL API client layer (makes HTTP calls)
│   │   ├── base.ts                 # BaseGHLClient -- fetch wrapper with auth headers
│   │   ├── index.ts                # GHLClient -- composes all 16 domain factories
│   │   ├── ai-agents.ts            # Voice AI, Conversation AI, Agent Studio
│   │   ├── automation.ts           # Workflows, forms, surveys
│   │   ├── businesses.ts           # Business CRUD
│   │   ├── calendars.ts            # Calendars, events, bookings, services
│   │   ├── contacts.ts             # Contacts, notes, tasks, tags
│   │   ├── content.ts              # Blogs, media, documents, menus, snapshots
│   │   ├── conversations.ts        # Messages, calls, transcriptions
│   │   ├── knowledge-base.ts       # KBs, FAQs, crawlers
│   │   ├── locations.ts            # Locations, users, custom fields
│   │   ├── marketing.ts            # Social, email, campaigns, funnels, links
│   │   ├── marketplace.ts          # Billing, app installations
│   │   ├── misc.ts                 # Companies, phone, products, objects, brands
│   │   ├── opportunities.ts        # Opportunities, pipelines
│   │   ├── payments.ts             # Invoices, orders, subscriptions, coupons
│   │   ├── saas.ts                 # SaaS rebilling, wallets
│   │   └── workflow-builder.ts     # Internal GHL API (Firebase auth) -- BETA
│   │
│   ├── tools/                      # MCP tool registrations (Zod schemas + handlers)
│   │   ├── index.ts                # registerAllTools() -- calls all 18 domain modules
│   │   ├── _helpers.ts             # ok(), err(), resolveClient() shared utilities
│   │   ├── _disabled/
│   │   │   └── pipeline-write.ts   # Pipeline CRUD (disabled -- GHL returns 401)
│   │   ├── accounts.ts             # 5 tools
│   │   ├── ai-agents.ts            # 26 tools
│   │   ├── automation.ts           # 11 tools
│   │   ├── businesses.ts           # 5 tools
│   │   ├── calendars.ts            # 56 tools
│   │   ├── contacts.ts             # 27 tools
│   │   ├── content.ts              # 41 tools
│   │   ├── conversations.ts        # 22 tools
│   │   ├── errors.ts               # 2 tools
│   │   ├── knowledge-base.ts       # 14 tools
│   │   ├── locations.ts            # 45 tools
│   │   ├── marketing.ts            # 70 tools
│   │   ├── marketplace.ts          # 9 tools
│   │   ├── misc.ts                 # 66 tools
│   │   ├── opportunities.ts        # 12 tools
│   │   ├── payments.ts             # 68 tools
│   │   ├── saas.ts                 # 13 tools
│   │   └── workflow-builder.ts     # 16 tools (BETA)
│   │
│   ├── db/
│   │   ├── accounts.ts             # D1: sub_accounts + oauth_tokens tables
│   │   ├── users.ts                # D1: users table, API key hashing
│   │   └── errors.ts               # D1: error capture table
│   │
│   ├── handlers/
│   │   ├── admin.ts                # Admin panel (HTML dashboard + REST API)
│   │   ├── oauth-callback.ts       # GHL OAuth code exchange + token storage
│   │   └── register.ts             # User self-registration form
│   │
│   └── utils/
│       ├── errors.ts               # GHLError class (statusCode + details)
│       ├── logger.ts               # Structured JSON logger with field redaction
│       ├── rate-limit.ts           # KV-based sliding window rate limiter
│       └── webhook.ts              # Optional error webhook sender
│
├── scripts/
│   ├── deploy.sh                   # Full deploy pipeline (both workers)
│   ├── check-duplicates.sh         # Detect duplicate tool names (crash prevention)
│   ├── count-tools.sh              # Tool count per domain (--detail for names)
│   ├── add-domain.sh               # Scaffold new domain module pair
│   └── add-tool.sh                 # Add tool to existing domain
│
├── migrations/
│   ├── 0001_create_users_table.sql
│   └── 0002_add_allowed_accounts.sql
│
├── wrangler.toml                   # Cloudflare Worker config (bindings, DO, D1, KV)
├── tsconfig.json
├── package.json
└── SERVER-MAP.md                   # Quick reference with all tool names + scope presets
```

### Two-Layer Module Pattern

Every GHL API domain has a parallel pair of files:

```
src/client/<domain>.ts   ->  Factory function returning async methods (HTTP calls)
src/tools/<domain>.ts    ->  registerXxxTools(server, env) registering MCP tools
```

**Client layer**: Each file exports a `domainMethods(client)` factory. `GHLClient` composes all 16 factories in its constructor.

**Tools layer**: Each file exports a `registerXxxTools(server, env)` function. `registerAllTools()` calls all 18 registration functions during `GHLMcpAgent.init()`.

## Deployment

### Requirements

- [Cloudflare Workers](https://workers.cloudflare.com/) account
- [Node.js](https://nodejs.org/) 18+
- A GHL account with API access
- GHL OAuth app credentials (for OAuth install flow)

### Setup from Scratch

```bash
git clone https://github.com/Bladefitness/dlf-ghl-mcp.git
cd dlf-ghl-mcp/dlf-ghl-mcp-server
npm install

# Create Cloudflare resources
npx wrangler d1 create ghl-accounts
npx wrangler kv namespace create OAUTH_KV

# Update wrangler.toml with the IDs from above

# Set required secrets
echo "your-admin-password" | npx wrangler secret put ADMIN_PASSWORD
echo "your-admin-pin" | npx wrangler secret put ADMIN_PIN
echo "your-ghl-client-id" | npx wrangler secret put GHL_CLIENT_ID
echo "your-ghl-client-secret" | npx wrangler secret put GHL_CLIENT_SECRET

# Optional: for workflow builder tools
echo "your-firebase-refresh-token" | npx wrangler secret put GHL_FIREBASE_REFRESH_TOKEN

# Deploy
npm run deploy

# Verify
curl https://your-worker.workers.dev/health
```

### Secrets Reference

| Secret | Required | Purpose |
|--------|----------|---------|
| `ADMIN_PASSWORD` | Yes | Admin panel login password |
| `ADMIN_PIN` | Yes | X-Admin-Pin header for API admin routes |
| `GHL_CLIENT_ID` | Yes | GHL OAuth app Client ID |
| `GHL_CLIENT_SECRET` | Yes | GHL OAuth app Client Secret |
| `GHL_FIREBASE_REFRESH_TOKEN` | No | Firebase refresh token (workflow builder BETA) |
| `GHL_FIREBASE_TOKEN` | No | Static Firebase ID token (fallback) |
| `ERROR_WEBHOOK_URL` | No | Webhook URL for error reports |

### Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `MCP_OBJECT` | Durable Object | MCP session persistence (`GHLMcpAgent`) |
| `GHL_DB` | D1 Database | Users, sub-accounts, OAuth tokens, errors |
| `OAUTH_KV` | KV Namespace | Auth context, sessions, rate limit counters |

### Deploy Script

```bash
# Full pipeline: duplicate check -> tsc -> deploy both workers -> health verify
./scripts/deploy.sh

# Dry run (no actual deploy)
./scripts/deploy.sh --dry-run

# Deploy only one worker
./scripts/deploy.sh --one dlf-agency
```

## Security

| Protection | How |
|-----------|-----|
| **API key hashing** | SHA-256 hash stored in D1 -- raw key never persisted |
| **Per-user scopes** | Default-deny: no scopes = no tools. Admin must grant access |
| **Account isolation** | Users can only access GHL locations in their `allowed_accounts` |
| **Rate limiting** | 120 req/min on `/mcp`, 5 req/min on `/signup` |
| **Header sanitization** | Incoming `X-User-Scopes`, `X-User-Allowed-Accounts` stripped to prevent spoofing |
| **Timing-safe auth** | Admin PIN uses HMAC-SHA256 constant-time comparison |
| **Session fingerprinting** | Admin sessions bound to IP + User-Agent |
| **Error redaction** | API keys, tokens, passwords masked in all error logs |
| **CORS** | Admin routes restricted to same-origin; public routes use wildcard |
| **Security headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` |

## GHL API Versions

| Version | Used For |
|---------|----------|
| `2021-07-28` | Most endpoints (contacts, conversations, invoices, workflows, etc.) |
| `2021-04-15` | Calendar events, blocked slots, Conversation AI agents, calls, transcriptions |

The correct version is set automatically per endpoint in each client module.

## Adding New Tools

### Add a tool to an existing domain

```bash
# Scaffold both client method + tool registration
./scripts/add-tool.sh contacts ghl_archive_contact

# Or manually:
# 1. Add method to src/client/contacts.ts
# 2. Add server.tool() to src/tools/contacts.ts
# 3. Run ./scripts/check-duplicates.sh to verify no name collision
```

### Add a new domain

```bash
# Scaffold the full module pair
./scripts/add-domain.sh new-domain

# Then wire it up:
# 1. Import factory in src/client/index.ts
# 2. Import register function in src/tools/index.ts
```

## D1 Database Schema

### users
```sql
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
email TEXT NOT NULL UNIQUE,
api_key TEXT NOT NULL UNIQUE,           -- SHA-256 hash of uk_<uuid>
status TEXT DEFAULT 'pending',          -- 'pending' | 'active' | 'disabled'
scopes TEXT DEFAULT '["*"]',            -- JSON array of tool names or ["*"]
allowed_accounts TEXT DEFAULT '["*"]',  -- JSON array of location IDs or ["*"]
created_at TEXT, updated_at TEXT, notes TEXT
```

### sub_accounts
```sql
id TEXT PRIMARY KEY,                    -- GHL Location ID
name TEXT NOT NULL,
api_key TEXT NOT NULL,                  -- Bearer token (PIT or OAuth)
account_type TEXT DEFAULT 'sub_account', -- 'sub_account' | 'oauth_location'
is_default INTEGER DEFAULT 0,
refresh_token TEXT,                     -- OAuth only
expires_at INTEGER,                     -- Unix timestamp, OAuth only
notes TEXT, created_at TEXT, updated_at TEXT
```

## Costs

| Resource | Free Tier | Paid |
|----------|-----------|------|
| Workers requests | 100K/day | $0.30/M |
| Durable Objects | -- | $0.15/M requests |
| D1 reads | 5M/day | $0.001/M rows |
| KV reads | 100K/day | $0.50/M reads |

For personal/small team use, this typically stays within free tier limits.

## License

[Apache 2.0](LICENSE)
