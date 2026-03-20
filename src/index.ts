/**
 * GHL MCP Server v2.0.1 — Modular Cloudflare Worker
 *
 * A remote MCP server giving AI agents full control over GoHighLevel
 * across multiple sub-accounts. Built with Hono routing, modular tools,
 * and layered security.
 *
 * Architecture:
 *   OAuthProvider wraps the entire worker:
 *     /mcp       → McpAgent Durable Object (254 tools)
 *     /authorize → OAuth auto-approve (private server)
 *     /token     → OAuth token endpoint
 *     /register  → OAuth client registration
 *     /*         → defaultHandler (health, CORS)
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Env } from "./types";
import { CONFIG } from "./config";
import { Logger } from "./utils";
import { registerAllTools } from "./tools";
import { initErrorsDb, logError } from "./db/errors";
import { sendErrorWebhook } from "./utils/webhook";
import { initOAuthTable } from "./db/accounts";
import { handleOAuthCallback } from "./handlers/oauth-callback";
import { handleRegister } from "./handlers/register";
import { handleAdmin } from "./handlers/admin";
import { initUsersDb, getUserByApiKey } from "./db/users";
import { checkRateLimit, getClientIp, rateLimitResponse } from "./utils/rate-limit";

// =============================================================
// Sensitive key redaction for error capture (CRIT-4 fix)
// =============================================================

const REDACT_PATTERNS = /api_key|apikey|token|authorization|password|secret|refresh/i;

function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (REDACT_PATTERNS.test(key)) {
      safe[key] = typeof value === "string" && value.length > 8
        ? value.slice(0, 4) + "***" + value.slice(-4)
        : "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      safe[key] = redactArgs(value as Record<string, unknown>);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

// =============================================================
// Error capture helper (fire-and-forget — never blocks MCP response)
// =============================================================

function captureError(
  env: Env,
  toolName: string,
  args: Record<string, unknown>,
  errorText: string
): void {
  (async () => {
    try {
      const safeArgs = redactArgs(args);
      await initErrorsDb(env.GHL_DB);
      const errorId = await logError(env.GHL_DB, toolName, errorText, safeArgs);
      if (env.ERROR_WEBHOOK_URL) {
        await sendErrorWebhook(env.ERROR_WEBHOOK_URL, {
          tool: toolName,
          error: errorText,
          args: safeArgs,
          error_id: errorId,
          timestamp: new Date().toISOString(),
          source: "ghl-mcp-v2",
        });
      }
    } catch {
      // Never let error capture crash the worker
    }
  })();
}

// =============================================================
// MCP Agent (Durable Object)
// =============================================================

export class GHLMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: CONFIG.MCP.NAME,
    version: CONFIG.MCP.VERSION,
  });

  /**
   * Per-request auth context. Set in fetch(), read in tool handlers.
   * Using a snapshot object instead of instance fields prevents concurrent
   * requests from clobbering each other's auth context (H-1 fix).
   */
  private requestAuth: {
    scopes: string[] | null;
    allowedAccounts: string[] | null;
  } = { scopes: null, allowedAccounts: null };

  /**
   * Check whether the current request's user is allowed to call a given tool.
   * Default-deny: if no user auth context is present, deny all tools.
   */
  private checkScope(toolName: string): boolean {
    const scopes = this.requestAuth.scopes;
    if (scopes === null) return false; // No user auth = deny all (HIGH-6 fix)
    if (scopes.includes("*")) return true;
    return scopes.includes(toolName);
  }

  async fetch(request: Request): Promise<Response> {
    // McpAgent.serve() strips custom headers during the WebSocket upgrade to the DO.
    // Only x-partykit-room (sessionId) and Upgrade survive. So we cannot rely on
    // X-User-Scopes or X-User-Allowed-Accounts headers — they're always null here.
    //
    // Instead, the outer wrapper stores auth context in KV keyed by user ID,
    // and passes the user ID via a query parameter on the URL (which DOES survive
    // the internal URL rewrite at McpAgent.serve() line 655).

    const url = new URL(request.url);
    const userId = url.searchParams.get("__uid");

    let scopes: string[] | null = null;
    let allowedAccounts: string[] | null = null;

    if (userId) {
      // Look up auth context from KV (stored by the outer wrapper)
      const raw = await (this.env as Env).OAUTH_KV.get(`mcp_auth:${userId}`);
      if (raw) {
        try {
          const auth = JSON.parse(raw) as { scopes: string; allowedAccounts: string };
          scopes = JSON.parse(auth.scopes) as string[];
          allowedAccounts = JSON.parse(auth.allowedAccounts) as string[];
        } catch {
          scopes = [];
          allowedAccounts = [];
        }
      }
    }

    // Atomically set the auth context for this request
    this.requestAuth = { scopes, allowedAccounts };

    // Set allowed accounts on env for resolveClient access control.
    (this.env as any).__allowedAccounts = allowedAccounts;

    return super.fetch(request);
  }

  async init() {
    const env = this.env;
    const agent = this;

    // Auto-capture errors AND enforce per-user scopes without touching individual handlers
    const originalTool = this.server.tool.bind(this.server);
    (this.server as any).tool = (name: string, desc: string, schema: any, handler: any) => {
      return originalTool(name, desc, schema, async (args: any) => {
        // Scope enforcement
        if (!agent.checkScope(name)) {
          return {
            content: [{ type: "text" as const, text: `Access denied: you do not have permission to use "${name}". Contact the admin to update your scopes.` }],
            isError: true,
          };
        }

        const result = await handler(args);
        if (result?.isError) {
          const errorText = result.content?.[0]?.text ?? "Unknown error";
          captureError(env, name, args, errorText);
        }
        return result;
      });
    };

    // Ensure OAuth table exists at startup
    await initOAuthTable(env.GHL_DB);

    registerAllTools(this.server, env);
  }
}

// =============================================================
// Default Handler (raw fetch — needed for OAUTH_PROVIDER access)
// =============================================================

const log = new Logger("http");

// =============================================================
// Admin PIN check (reads X-Admin-Pin header)
// =============================================================

// Timing-safe comparison for admin PIN (HIGH-3 fix)
async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode("pin-compare-key");
  const key = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(sigA);
  const viewB = new Uint8Array(sigB);
  if (viewA.length !== viewB.length) return false;
  let result = 0;
  for (let i = 0; i < viewA.length; i++) {
    result |= viewA[i] ^ viewB[i];
  }
  return result === 0;
}

async function checkAdminPin(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_PIN) return false;
  const pin = request.headers.get("X-Admin-Pin");
  if (!pin) return false;
  return timingSafeCompare(pin, env.ADMIN_PIN);
}

function pinRequired(): Response {
  return Response.json(
    { error: "Unauthorized", hint: "Set X-Admin-Pin header with your admin PIN" },
    { status: 401 }
  );
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, X-Requested-With, mcp-session-id, mcp-protocol-version, X-User-Key, X-Admin-Pin",
  // MED-1 fix: security headers on all responses
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const defaultHandler = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
  const url = new URL(request.url);

  // Handle CORS preflight — restrict admin routes to same-origin
  if (request.method === "OPTIONS") {
    if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/admin")) {
      const origin = request.headers.get("Origin") ?? "";
      const selfOrigin = url.origin;
      const allowedOrigin = origin === selfOrigin ? selfOrigin : "null";
      return new Response(null, { status: 204, headers: {
        ...CORS_HEADERS,
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
      }});
    }
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Health checks
  if (url.pathname === "/" || url.pathname === "/health") {
    return Response.json(
      {
        status: "ok",
        server: CONFIG.MCP.NAME,
        version: CONFIG.MCP.VERSION,
        mcp_endpoint: "/mcp",
      },
      { headers: CORS_HEADERS }
    );
  }

  // GHL OAuth callback — handles agency app install
  if (url.pathname === "/callback" && request.method === "GET") {
    return handleOAuthCallback(request, env);
  }

  // OAuth userinfo endpoint — required for External Authentication setup in GHL
  // MED-3 fix: no email exposure, minimal info
  if (url.pathname === "/userinfo") {
    return Response.json(
      { id: "owner", name: "GHL MCP Server" },
      { headers: CORS_HEADERS }
    );
  }

  // Admin: view agency PIV token (masked — PIN required)
  if (url.pathname === "/admin/agency-token" && request.method === "GET") {
    if (!(await checkAdminPin(request, env))) return pinRequired();
    const token = await env.OAUTH_KV.get("agency:pit_token");
    if (!token) {
      return Response.json({ error: "No agency token stored" }, { status: 404, headers: CORS_HEADERS });
    }
    // Show first 12 chars + *** + last 4 — enough to confirm which token without exposing it
    const masked = token.slice(0, 12) + "***" + token.slice(-4);
    return Response.json({ token: masked }, { headers: CORS_HEADERS });
  }

  // Admin: store/rotate agency PIV token (PIN required)
  if (url.pathname === "/admin/agency-token" && request.method === "POST") {
    if (!(await checkAdminPin(request, env))) return pinRequired();
    let body: { token?: string };
    try {
      body = (await request.json()) as { token?: string };
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!body.token) {
      return Response.json({ error: "Missing token in request body" }, { status: 400, headers: CORS_HEADERS });
    }
    await env.OAUTH_KV.put("agency:pit_token", body.token);
    return Response.json({ ok: true, message: "Agency token stored successfully" }, { headers: CORS_HEADERS });
  }

  // Admin: refresh all location tokens that have refresh_tokens stored
  if (url.pathname === "/refresh" && request.method === "POST") {
    if (!(await checkAdminPin(request, env))) return pinRequired();
    try {
      const { refreshLocationToken, initDb } = await import("./db/accounts");
      await initDb(env.GHL_DB);

      const locs = (await env.GHL_DB
        .prepare("SELECT id, name, refresh_token, expires_at FROM sub_accounts WHERE refresh_token IS NOT NULL")
        .all<{ id: string; name: string; refresh_token: string | null; expires_at: number | null }>()
      ).results ?? [];

      const results: Record<string, string> = {};
      for (const loc of locs) {
        try {
          await refreshLocationToken(env, loc.id);
          results[loc.name] = "refreshed";
        } catch (e: any) {
          results[loc.name] = `failed: ${e.message}`;
        }
      }
      return Response.json({ ok: true, results }, { headers: CORS_HEADERS });
    } catch (e: any) {
      return Response.json({ ok: false, error: e.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // Admin: return the OAuth install URL
  if (url.pathname === "/install" && request.method === "GET") {
    const scopes = [
      "businesses.readonly", "businesses.write",
      "calendars.readonly", "calendars.write",
      "calendars/events.readonly", "calendars/events.write",
      "campaigns.readonly",
      "contacts.readonly", "contacts.write",
      "conversations.readonly", "conversations.write",
      "conversations/message.readonly", "conversations/message.write",
      "forms.readonly",
      "invoices.readonly", "invoices.write",
      "invoices/schedule.readonly", "invoices/schedule.write",
      "links.readonly", "links.write",
      "locations.readonly",
      "locations/customFields.readonly", "locations/customFields.write",
      "locations/customValues.readonly", "locations/customValues.write",
      "locations/tags.readonly", "locations/tags.write",
      "medias.readonly", "medias.write",
      "opportunities.readonly", "opportunities.write",
      "payments/orders.readonly", "payments/subscriptions.readonly", "payments/transactions.readonly",
      "products.readonly", "products.write",
      "snapshots.readonly",
      "users.readonly", "users.write",
      "workflows.readonly",
      "oauth.write", "oauth.readonly",
    ].join(" ");

    const installUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent("https://dlf-agency.skool-203.workers.dev/callback")}&client_id=${env.GHL_CLIENT_ID}&scope=${encodeURIComponent(scopes)}`;

    return Response.json({ install_url: installUrl }, { headers: CORS_HEADERS });
  }

  // User registration — rate limited: 5 per minute per IP
  if (url.pathname === "/signup") {
    if (request.method === "POST") {
      const ip = getClientIp(request);
      const rl = await checkRateLimit(env.OAUTH_KV, `rl:signup:${ip}`, 5, 60);
      if (!rl.allowed) return rateLimitResponse(rl);
    }
    return handleRegister(request, env);
  }

  // Admin panel and API
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/") || url.pathname.startsWith("/api/admin")) {
    return handleAdmin(request, env);
  }

  // OAuth authorize — requires admin PIN, session, or valid user key (CRIT-2 fix)
  if (url.pathname === "/authorize") {
    const hasPin = await checkAdminPin(request, env);
    const hasSession = await (async () => {
      const cookie = request.headers.get("Cookie") ?? "";
      const match = cookie.match(/admin_session=([^;]+)/);
      if (!match) return false;
      const raw = await env.OAUTH_KV.get(`admin_session_${match[1]}`);
      if (!raw) return false;
      try {
        const session = JSON.parse(raw) as { valid: boolean };
        return session.valid === true;
      } catch {
        return false; // reject legacy non-JSON sessions
      }
    })();
    // Also allow if a valid active user key is present (MCP clients auto-authorize)
    const hasUserKey = await (async () => {
      const uk = request.headers.get("X-User-Key") || url.searchParams.get("user_key");
      if (!uk) return false;
      await initUsersDb(env.GHL_DB);
      const u = await getUserByApiKey(env.GHL_DB, uk);
      return !!u && u.status === "active";
    })();

    if (!hasPin && !hasSession && !hasUserKey) {
      return Response.json(
        { error: "Unauthorized", hint: "OAuth authorize requires admin PIN header (X-Admin-Pin), active admin session, or valid user key." },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const oauthReqInfo = await (env as any).OAUTH_PROVIDER.parseAuthRequest(
      request
    );
    log.info("OAuth authorize request (admin-authenticated)", {
      client_id: oauthReqInfo?.clientId,
    });

    const { redirectTo } = await (
      env as any
    ).OAUTH_PROVIDER.completeAuthorization({
      request: oauthReqInfo,
      userId: "owner",
      metadata: { label: "GHL MCP Owner" },
      scope: oauthReqInfo.scope,
      props: { userId: "owner" },
    });

    return Response.redirect(redirectTo, 302);
  }

  // Catch-all 404
  return Response.json(
    { error: "Not found", hint: "MCP endpoint is at /mcp" },
    { status: 404, headers: CORS_HEADERS }
  );
  },
};

// =============================================================
// Export: OAuthProvider wraps everything, with user-key gating on /mcp
// =============================================================

// Direct DO handler — used when user-key auth bypasses OAuth
const mcpHandler = GHLMcpAgent.serve("/mcp") as unknown as {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
};

const oauthProvider = new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: mcpHandler as any,
  defaultHandler: defaultHandler as any,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});

/**
 * Outer fetch wrapper — intercepts /mcp requests to enforce user API key
 * authentication before passing through to the OAuthProvider.
 *
 * All other routes pass straight through to OAuthProvider (which dispatches
 * to defaultHandler for non-OAuth/non-MCP routes).
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Only gate /mcp with user-key auth
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      // HIGH-2 fix: rate limit MCP endpoint — 120 requests per minute per IP
      const clientIp = getClientIp(request);
      const rl = await checkRateLimit(env.OAUTH_KV, `rl:mcp:${clientIp}`, 120, 60);
      if (!rl.allowed) return rateLimitResponse(rl);

      // MED-5: prefer X-User-Key header; query string is deprecated (logged in access logs)
      const userKeyFromQuery = url.searchParams.get("user_key");
      const userKey = request.headers.get("X-User-Key") || userKeyFromQuery;

      // CRIT-1 fix: Always strip internal security headers from incoming requests
      // so clients cannot spoof scopes or account access
      const sanitizedHeaders = new Headers(request.headers);
      sanitizedHeaders.delete("X-User-Scopes");
      sanitizedHeaders.delete("X-User-Allowed-Accounts");
      sanitizedHeaders.delete("X-User-Id");

      if (userKey) {
        // Validate the user key
        await initUsersDb(env.GHL_DB);
        const user = await getUserByApiKey(env.GHL_DB, userKey);

        if (!user) {
          return Response.json(
            {
              error: "Invalid API key",
              hint: "Register at /signup to get a valid key.",
            },
            { status: 401, headers: CORS_HEADERS }
          );
        }

        if (user.status !== "active") {
          const reason =
            user.status === "pending"
              ? "Your account is pending admin approval."
              : "Your account has been disabled.";
          return Response.json(
            { error: "Access denied", reason },
            { status: 403, headers: CORS_HEADERS }
          );
        }

        // Store auth context in KV so the DO can read it.
        // McpAgent.serve() strips custom headers during internal WebSocket upgrade,
        // so we can't pass scopes/accounts via headers. KV keyed by user ID persists
        // across all requests in the session. User ID is passed via URL query param
        // (which DOES survive the internal URL rewrite).
        await env.OAUTH_KV.put(
          `mcp_auth:${user.id}`,
          JSON.stringify({
            scopes: user.scopes,
            allowedAccounts: user.allowed_accounts ?? '["*"]',
          }),
          { expirationTtl: 86400 } // 24h TTL
        );

        // Remove user_key from query string so it doesn't leak downstream
        url.searchParams.delete("user_key");
        // Pass user ID via query param — the DO reads this to look up auth from KV
        url.searchParams.set("__uid", user.id);

        const newRequest = new Request(url.toString(), {
          method: request.method,
          headers: sanitizedHeaders,
          body: request.body,
          // @ts-expect-error duplex needed for streaming body
          duplex: "half",
        });
        // Route directly to the Durable Object, bypassing OAuthProvider.
        // User-key auth replaces OAuth — no need for both layers.
        return mcpHandler.fetch(newRequest, env, ctx);
      }

      // No user key — still strip headers and pass through
      // The DO will see null userScopes and default-deny (HIGH-6 fix)
      const cleanRequest = new Request(url.toString(), {
        method: request.method,
        headers: sanitizedHeaders,
        body: request.body,
        // @ts-expect-error duplex needed for streaming body
        duplex: "half",
      });
      return oauthProvider.fetch(cleanRequest, env, ctx);
    }

    // Block open OAuth client registration — allow if admin PIN OR valid user key
    if (url.pathname === "/register" || url.pathname.startsWith("/register/")) {
      const hasPin = await checkAdminPin(request, env);
      if (!hasPin) {
        // Also allow if request carries a valid active user key (MCP clients need
        // to register OAuth clients as part of the standard connection flow)
        const uk = request.headers.get("X-User-Key") || url.searchParams.get("user_key");
        let hasValidKey = false;
        if (uk) {
          await initUsersDb(env.GHL_DB);
          const u = await getUserByApiKey(env.GHL_DB, uk);
          hasValidKey = !!u && u.status === "active";
        }
        if (!hasValidKey) {
          return Response.json(
            { error: "Unauthorized", hint: "OAuth client registration requires admin PIN or valid user key." },
            { status: 401, headers: CORS_HEADERS }
          );
        }
      }
    }

    return oauthProvider.fetch(request, env, ctx);
  },
};
