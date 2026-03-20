/**
 * GHL Internal Workflow Builder Client
 * Uses backend.leadconnectorhq.com (undocumented internal API)
 * Auth: JWT via token-id header
 * Auto-refreshes tokens using GHL's /auth/refresh endpoint + KV cache
 */

const INTERNAL_BASE = "https://backend.leadconnectorhq.com";
const KV_TOKEN_KEY = "ghl_firebase_id_token";
const KV_REFRESH_KEY = "ghl_refresh_token";
const KV_TOKEN_TTL = 3300; // 55 minutes (tokens last 60, refresh early)

export interface WorkflowBuilderConfig {
  firebaseToken: string;
  locationId: string;
  kv?: KVNamespace; // for caching refreshed tokens
  refreshToken?: string; // GHL RS256 refresh token (30 days, rotates on use)
}

/**
 * Refresh a GHL session token using GHL's /auth/refresh endpoint.
 * Returns a fresh JWT (usable as token-id) and a new refresh token.
 * The refresh token rotates on each use — always store the new one.
 */
async function refreshGHLToken(refreshToken: string): Promise<{ jwt: string; refreshJwt: string }> {
  const resp = await fetch(`${INTERNAL_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", channel: "APP" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GHL token refresh failed (${resp.status}): ${err}`);
  }
  const data = await resp.json() as { jwt: string; refreshJwt: string };
  return { jwt: data.jwt, refreshJwt: data.refreshJwt };
}

/**
 * Get a valid token for the token-id header, using KV cache or refreshing as needed.
 */
async function getValidToken(config: WorkflowBuilderConfig): Promise<string> {
  // If we have KV and a refresh token, use the cache + auto-refresh flow
  if (config.kv && config.refreshToken) {
    const cached = await config.kv.get(KV_TOKEN_KEY);
    if (cached) return cached;

    // Cache miss or expired — get latest refresh token (may have been rotated)
    const currentRefresh = await config.kv.get(KV_REFRESH_KEY) || config.refreshToken;

    // Refresh via GHL's endpoint
    const { jwt, refreshJwt } = await refreshGHLToken(currentRefresh);

    // Cache the new token and store the rotated refresh token
    await config.kv.put(KV_TOKEN_KEY, jwt, { expirationTtl: KV_TOKEN_TTL });
    await config.kv.put(KV_REFRESH_KEY, refreshJwt);
    return jwt;
  }

  // Fallback: use the static token from config (may be expired)
  return config.firebaseToken;
}

async function internalRequest<T>(
  config: WorkflowBuilderConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getValidToken(config);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    channel: "APP",
    Authorization: `Bearer ${token}`,
  };

  const resp = await fetch(`${INTERNAL_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If 401/403 and we have refresh capability, force-refresh and retry once
  if ((resp.status === 401 || resp.status === 403) && config.kv && config.refreshToken) {
    const currentRefresh = await config.kv.get(KV_REFRESH_KEY) || config.refreshToken;
    const { jwt, refreshJwt } = await refreshGHLToken(currentRefresh);
    await config.kv.put(KV_TOKEN_KEY, jwt, { expirationTtl: KV_TOKEN_TTL });
    await config.kv.put(KV_REFRESH_KEY, refreshJwt);
    headers["Authorization"] = `Bearer ${jwt}`;

    const retry = await fetch(`${INTERNAL_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!retry.ok) {
      const errorText = await retry.text();
      throw new Error(`GHL Internal API ${retry.status}: ${errorText}`);
    }
    const text = await retry.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`GHL Internal API ${resp.status}: ${errorText}`);
  }

  const text = await resp.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export function workflowBuilderMethods(config: WorkflowBuilderConfig) {
  const loc = config.locationId;

  return {
    // ===== WORKFLOW CRUD =====

    async listWorkflows(opts?: {
      parentId?: string;
      type?: string;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: string;
    }) {
      const params = new URLSearchParams();
      params.set("parentId", opts?.parentId || "root");
      params.set("limit", String(opts?.limit || 50));
      params.set("offset", String(opts?.offset || 0));
      params.set("sortBy", opts?.sortBy || "name");
      params.set("sortOrder", opts?.sortOrder || "asc");
      if (opts?.type) params.set("type", opts.type);
      params.set("includeCustomObjects", "true");
      params.set("includeObjectiveBuilder", "true");
      return internalRequest<{ rows: any[]; total?: number }>(
        config,
        "GET",
        `/workflow/${loc}/list?${params}`
      );
    },

    async createWorkflow(name: string, parentId?: string) {
      const body: Record<string, unknown> = { name };
      if (parentId) body.parentId = parentId;
      return internalRequest<{ id: string }>(
        config,
        "POST",
        `/workflow/${loc}`,
        body
      );
    },

    async getWorkflow(workflowId: string) {
      return internalRequest<any>(
        config,
        "GET",
        `/workflow/${loc}/${workflowId}`
      );
    },

    async updateWorkflow(
      workflowId: string,
      data: {
        version: number;
        name?: string;
        workflowData?: { templates: any[] };
        [key: string]: any;
      }
    ) {
      // GHL's PUT replaces the entire document. Fetch current state and merge
      // to avoid accidentally wiping name, workflowData, or other fields.
      const current = await internalRequest<any>(
        config,
        "GET",
        `/workflow/${loc}/${workflowId}`
      );
      const merged = {
        name: current.name,
        workflowData: current.workflowData,
        allowMultiple: current.allowMultiple,
        stopOnResponse: current.stopOnResponse,
        autoMarkAsRead: current.autoMarkAsRead,
        removeContactFromLastStep: current.removeContactFromLastStep,
        timezone: current.timezone,
        ...data,
      };
      return internalRequest<any>(
        config,
        "PUT",
        `/workflow/${loc}/${workflowId}`,
        merged
      );
    },

    async deleteWorkflow(workflowId: string) {
      return internalRequest<{ success: boolean }>(
        config,
        "DELETE",
        `/workflow/${loc}/${workflowId}`
      );
    },

    async changeWorkflowStatus(
      workflowId: string,
      status: "published" | "draft",
      updatedBy: string
    ) {
      return internalRequest<any>(
        config,
        "PUT",
        `/workflow/${loc}/change-status/${workflowId}`,
        { status, updatedBy }
      );
    },

    // ===== WORKFLOW DATA (Firebase Storage) =====

    async getWorkflowData(workflowId: string): Promise<{ templates: any[] }> {
      const wf = await this.getWorkflow(workflowId);
      if (!wf.fileUrl) return { templates: [] };
      const resp = await fetch(wf.fileUrl);
      if (!resp.ok) return { templates: [] };
      return resp.json();
    },

    async getWorkflowTriggers(workflowId: string): Promise<any[]> {
      const wf = await this.getWorkflow(workflowId);
      if (!wf.triggersFilePath) return [];
      const encodedPath = encodeURIComponent(wf.triggersFilePath);
      const url = `https://firebasestorage.googleapis.com/v0/b/highlevel-backend.appspot.com/o/${encodedPath}?alt=media`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) return [];
        return resp.json();
      } catch {
        return [];
      }
    },

    // ===== TRIGGER CRUD =====

    async createTrigger(data: {
      type: string;
      name: string;
      active: boolean;
      workflowId: string;
      conditions?: any[];
      actions?: any[];
      [key: string]: any;
    }) {
      return internalRequest<{ id: string }>(
        config,
        "POST",
        `/workflow/${loc}/trigger`,
        { masterType: "highlevel", belongs_to: "workflow", location_id: loc, ...data }
      );
    },

    async updateTrigger(triggerId: string, data: any) {
      return internalRequest<any>(
        config,
        "PUT",
        `/workflow/${loc}/trigger/${triggerId}`,
        data
      );
    },

    async deleteTrigger(triggerId: string) {
      return internalRequest<string>(
        config,
        "DELETE",
        `/workflow/${loc}/trigger/${triggerId}`
      );
    },

    // ===== FOLDER MANAGEMENT =====

    async createFolder(name: string, parentId?: string) {
      return internalRequest<{ id: string }>(
        config,
        "POST",
        `/workflow/${loc}`,
        { name, type: "directory", parentId: parentId || null }
      );
    },

    // ===== UTILITY =====

    async getErrorCount() {
      return internalRequest<number>(
        config,
        "GET",
        `/workflow/${loc}/error-notification/count`
      );
    },

    async getWorkflowAISettings() {
      return internalRequest<any>(
        config,
        "GET",
        `/workflow/${loc}/workflow-ai/settings`
      );
    },
  };
}
