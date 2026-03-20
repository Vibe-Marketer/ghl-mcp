/**
 * User Registration handler — /signup
 *
 * GET  /signup → HTML registration form
 * POST /signup → Creates user in D1, returns API key (shown once)
 */

import type { Env } from "../types";
import { initUsersDb, createUser, getUserByEmail } from "../db/users";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ---------------------------------------------------------------------------
// HTML form
// ---------------------------------------------------------------------------

function registrationPage(message?: string, apiKey?: string, error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register — GHL MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; color: #e2e8f0; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #1e293b; border: 1px solid #334155; border-radius: 12px;
      padding: 2rem; max-width: 440px; width: 100%;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #f8fafc; }
    p.sub { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; color: #cbd5e1; margin-bottom: 0.25rem; }
    input[type="text"], input[type="email"] {
      width: 100%; padding: 0.6rem 0.75rem; border-radius: 6px;
      border: 1px solid #475569; background: #0f172a; color: #f1f5f9;
      font-size: 0.9rem; margin-bottom: 1rem; outline: none;
    }
    input:focus { border-color: #3b82f6; }
    button {
      width: 100%; padding: 0.7rem; border: none; border-radius: 6px;
      background: #3b82f6; color: #fff; font-size: 0.9rem; font-weight: 600;
      cursor: pointer; transition: background 0.2s;
    }
    button:hover { background: #2563eb; }
    .msg { padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem; }
    .msg.error { background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5; }
    .msg.success { background: #14532d; border: 1px solid #166534; color: #86efac; }
    .key-box {
      background: #0f172a; border: 1px solid #475569; border-radius: 6px;
      padding: 0.75rem; font-family: monospace; font-size: 0.85rem;
      word-break: break-all; margin: 0.75rem 0; color: #fbbf24;
    }
    .warn { color: #f59e0b; font-size: 0.8rem; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Register for MCP Access</h1>
    <p class="sub">Get an API key to use the GoHighLevel MCP server.</p>

    ${error ? `<div class="msg error">${escapeHtml(error)}</div>` : ""}
    ${message ? `<div class="msg success">${escapeHtml(message)}</div>` : ""}
    ${apiKey ? `
      <p style="font-size:0.875rem; color:#cbd5e1;">Your API Key (shown once — save it now):</p>
      <div class="key-box">${escapeHtml(apiKey)}</div>
      <p class="warn">This key will not be shown again. Store it securely.</p>
      <p style="font-size:0.8rem; color:#94a3b8; margin-top:1rem;">
        <strong>Usage:</strong> Add <code>?user_key=YOUR_KEY</code> to the MCP URL, or set the
        <code>X-User-Key</code> header.
      </p>
      <p style="font-size:0.8rem; color:#94a3b8; margin-top:0.5rem;">
        Your account is <strong>pending</strong> until an admin activates it.
      </p>
    ` : `
      <form method="POST" action="/signup">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" required placeholder="Your name" />
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="you@example.com" />
        <button type="submit">Register</button>
      </form>
    `}
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;"); // M-4 fix: escape single quotes
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleRegister(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method === "GET") {
    return new Response(registrationPage(), {
      headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS },
    });
  }

  if (request.method === "POST") {
    await initUsersDb(env.GHL_DB);

    let name: string;
    let email: string;

    const contentType = request.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { name?: string; email?: string };
      name = (body.name ?? "").trim();
      email = (body.email ?? "").trim();
    } else {
      const form = await request.formData();
      name = (form.get("name") as string ?? "").trim();
      email = (form.get("email") as string ?? "").trim();
    }

    if (!name || !email) {
      const html = registrationPage(undefined, undefined, "Name and email are required.");
      return new Response(html, {
        status: 400,
        headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS },
      });
    }

    // LOW-3 fix: input length validation
    if (name.length > 200 || email.length > 254) {
      const html = registrationPage(undefined, undefined, "Name or email exceeds maximum length.");
      return new Response(html, {
        status: 400,
        headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS },
      });
    }

    // Check for existing email
    const existing = await getUserByEmail(env.GHL_DB, email);
    if (existing) {
      const html = registrationPage(undefined, undefined, "An account with this email already exists.");
      return new Response(html, {
        status: 409,
        headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS },
      });
    }

    try {
      const { rawApiKey } = await createUser(env.GHL_DB, name, email);
      const html = registrationPage("Registration successful!", rawApiKey);
      return new Response(html, {
        headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS },
      });
    } catch (e: any) {
      // M-5 fix: don't leak internal error details to users
      console.error("Registration error:", e.message);
      const html = registrationPage(undefined, undefined, "Registration failed. Please try again or contact the admin.");
      return new Response(html, {
        status: 500,
        headers: { "Content-Type": "text/html;charset=UTF-8", ...CORS_HEADERS },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
}
