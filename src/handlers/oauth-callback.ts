/**
 * GHL OAuth Callback Handler
 *
 * Handles both Private Integration (Location) and Marketplace (Company/Agency)
 * OAuth install flows via a single code exchange:
 *
 *   GET /callback?code=xxx
 *
 *   Strategy — exchange the auth code ONCE with user_type="Location":
 *     - If response contains `locationId`  → Private Integration / Location flow
 *       Store the location token directly in sub_accounts.
 *     - If response contains `companyId`   → Marketplace / Agency flow
 *       The code has been consumed for a company token; proceed with the
 *       existing agency flow (store token, list locations, derive location tokens).
 *
 *   The auth code is SINGLE USE, so we never call /oauth/token twice.
 */

import type { Env } from "../types";
import { CONFIG } from "../config";
import {
  initDb,
  initOAuthTable,
  storeAgencyToken,
  upsertSubAccountFromOAuth,
} from "../db/accounts";

// ---------------------------------------------------------------------------
// Response type union — GHL returns one of these two shapes
// ---------------------------------------------------------------------------

interface LocationTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  locationId: string;        // present for user_type=Location
  userType?: string;
  scope?: string;
}

interface AgencyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  companyId: string;         // present for user_type=Company
  userType?: string;
  userId?: string;
  scope?: string;
}

// Raw exchange result — either shape (we discriminate by field presence)
type OAuthTokenResponse =
  | (LocationTokenResponse & { companyId?: never })
  | (AgencyTokenResponse & { locationId?: never });

interface InstalledLocationsResponse {
  locations?: Array<{ locationId: string; name: string }>;
  installedLocations?: Array<{ locationId: string; name: string }>;
}

interface DerivedLocationTokenResponse {
  access_token?: string;
  token?: string;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function jsonError(message: string, details?: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function locationSuccessHtml(locationId: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GHL MCP — Location Connected</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 24px; color: #111; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #444; line-height: 1.6; }
    .badge { display: inline-block; background: #16a34a; color: #fff; border-radius: 6px; padding: 4px 12px; font-size: 0.875rem; font-weight: 600; margin-bottom: 1.5rem; }
    code { background: #f3f4f6; border-radius: 4px; padding: 2px 6px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="badge">Connected</div>
  <h1>Location connected</h1>
  <p>Location <strong><code>${locationId}</code></strong> is now ready via the MCP server.</p>
  <p>To connect additional locations, run the OAuth flow again and select a different location.</p>
  <p>You can close this window.</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function agencySuccessHtml(locationCount: number): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GHL MCP — Installation Complete</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 24px; color: #111; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #444; line-height: 1.6; }
    .badge { display: inline-block; background: #16a34a; color: #fff; border-radius: 6px; padding: 4px 12px; font-size: 0.875rem; font-weight: 600; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="badge">Installation complete</div>
  <h1>GHL MCP Server connected</h1>
  <p>
    Your agency OAuth app has been authorised successfully.
    <strong>${locationCount} location${locationCount !== 1 ? "s" : ""}</strong>
    ${locationCount !== 1 ? "have" : "has"} been provisioned and are ready to use via the MCP server.
  </p>
  <p>You can close this window.</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleOAuthCallback(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return jsonError("Missing code parameter");
  }

  // Ensure both tables exist and have the latest schema (including refresh_token/expires_at columns)
  await initDb(env.GHL_DB);
  await initOAuthTable(env.GHL_DB);

  // --- Step 1: Exchange code ONCE with user_type="Location" ---
  // We start with "Location" because it works for Private Integration apps.
  // If GHL returns companyId instead, it means the app is a Marketplace/agency
  // app and we fall through to the company flow with the same token — no second
  // exchange needed (the code is now consumed).
  const tokenBody = new URLSearchParams({
    client_id: env.GHL_CLIENT_ID,
    client_secret: env.GHL_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    user_type: "Location",
  });

  let rawResponse: OAuthTokenResponse;
  try {
    const tokenRes = await fetch(`${CONFIG.API.BASE_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      // HIGH-5 fix: don't leak GHL error body to caller — log server-side only
      const text = await tokenRes.text().catch(() => "(no body)");
      console.error(`[oauth-callback] Token exchange failed: status=${tokenRes.status} body=${text}`);
      return jsonError(
        "Failed to exchange authorization code with GHL",
        `GHL returned status ${tokenRes.status}. Check server logs for details.`,
        502
      );
    }

    rawResponse = (await tokenRes.json()) as OAuthTokenResponse;
  } catch (e) {
    return jsonError("Token exchange request failed", String(e), 502);
  }

  if (!rawResponse.access_token) {
    // HIGH-5 fix: don't leak raw GHL response (may contain partial tokens)
    console.error(`[oauth-callback] Incomplete token response: ${JSON.stringify(rawResponse)}`);
    return jsonError(
      "Incomplete token response from GHL",
      "The response did not contain an access token. Check server logs.",
      502
    );
  }

  // --- Step 2: Discriminate — Location vs Agency token ---

  if ("locationId" in rawResponse && rawResponse.locationId) {
    // -----------------------------------------------------------------------
    // PRIVATE INTEGRATION FLOW — location token returned directly
    // -----------------------------------------------------------------------
    return handleLocationFlow(env, rawResponse as LocationTokenResponse);
  }

  if ("companyId" in rawResponse && rawResponse.companyId) {
    // -----------------------------------------------------------------------
    // MARKETPLACE / AGENCY FLOW — company token returned
    // -----------------------------------------------------------------------
    return handleAgencyFlow(env, rawResponse as AgencyTokenResponse);
  }

  // Neither locationId nor companyId — unexpected GHL response
  console.error(`[oauth-callback] Unrecognised token response: ${JSON.stringify(rawResponse)}`);
  return jsonError(
    "Unrecognised token response from GHL (no locationId or companyId)",
    "Check server logs for the raw response.",
    502
  );
}

// ---------------------------------------------------------------------------
// Location flow (Private Integration apps)
// ---------------------------------------------------------------------------

async function handleLocationFlow(
  env: Env,
  data: LocationTokenResponse
): Promise<Response> {
  const { access_token, refresh_token, expires_in, locationId } = data;

  const expiresAt = Math.floor(Date.now() / 1000) + (expires_in ?? 86400);

  await upsertSubAccountFromOAuth(
    env.GHL_DB,
    locationId,
    locationId,            // name fallback — we don't know the display name yet
    access_token,
    "location-oauth",      // companyId placeholder for private integration
    refresh_token,         // new optional param
    expiresAt              // new optional param
  );

  return locationSuccessHtml(locationId);
}

// ---------------------------------------------------------------------------
// Agency / Marketplace flow (existing logic, unchanged behaviour)
// ---------------------------------------------------------------------------

async function handleAgencyFlow(
  env: Env,
  data: AgencyTokenResponse
): Promise<Response> {
  const { access_token, refresh_token, expires_in, companyId, userId } = data;

  if (!refresh_token) {
    return new Response(
      JSON.stringify({ error: "Incomplete agency token response — missing refresh_token" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Store agency token
  const expiresAt = Math.floor(Date.now() / 1000) + (expires_in ?? 86400);
  await storeAgencyToken(env.GHL_DB, {
    access_token,
    refresh_token,
    expires_at: expiresAt,
    company_id: companyId,
    user_id: userId,
  });

  // List installed locations
  let locations: Array<{ locationId: string; name: string }> = [];
  try {
    const locRes = await fetch(
      `${CONFIG.API.BASE_URL}/oauth/installedLocations?appId=${encodeURIComponent(env.GHL_CLIENT_ID)}&isInstalled=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          Version: CONFIG.API.VERSION_STANDARD,
          Accept: "application/json",
        },
      }
    );

    if (locRes.ok) {
      const locData = (await locRes.json()) as InstalledLocationsResponse;
      locations = locData.locations ?? locData.installedLocations ?? [];
    }
    // Non-fatal — continue even if 0 locations returned
  } catch {
    // Non-fatal
  }

  // Derive a location-scoped token for each installed location and upsert
  let provisioned = 0;
  for (const loc of locations) {
    try {
      const locTokenBody = new URLSearchParams({
        companyId,
        locationId: loc.locationId,
      });

      const locTokenRes = await fetch(CONFIG.API.LOCATION_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: `Bearer ${access_token}`,
          Version: CONFIG.API.VERSION_STANDARD,
        },
        body: locTokenBody.toString(),
      });

      if (!locTokenRes.ok) continue;

      const locTokenData =
        (await locTokenRes.json()) as DerivedLocationTokenResponse;
      const locToken = locTokenData.access_token ?? locTokenData.token;
      if (!locToken) continue;

      await upsertSubAccountFromOAuth(
        env.GHL_DB,
        loc.locationId,
        loc.name,
        locToken,
        companyId
        // refreshToken and expiresAt not available from locationToken endpoint
      );
      provisioned++;
    } catch {
      // Skip this location and continue
    }
  }

  return agencySuccessHtml(provisioned);
}
