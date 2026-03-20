import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err } from "./_helpers";
import { initDb, getAccountById, getAccountByName } from "../db/accounts";

// HIGH-7 fix: account management tools require admin-level access (wildcard scope + wildcard accounts)
function isAdminScope(env: Env): boolean {
  const accounts: string[] | null = (env as any).__allowedAccounts ?? null;
  return accounts === null || accounts.includes("*");
}

export function registerAccountsTools(server: McpServer, env: Env) {
  server.tool(
    "ghl_add_sub_account",
    `Register a GHL sub-account. Stores the location ID, name, and API token securely.
Set isDefault=true to make this the default account for all operations.
(Admin-only: requires wildcard account access.)`,
    {
      locationId: z.string().describe("The GHL Location ID"),
      name: z.string().describe('Friendly name (e.g. "Dr. Smith Dental")'),
      apiKey: z.string().describe("Private Integration Token"),
      accountType: z
        .enum(["agency", "sub_account"])
        .default("sub_account")
        .describe("Account type"),
      isDefault: z
        .boolean()
        .default(false)
        .describe("Set as the default account"),
      notes: z.string().optional().describe("Optional notes"),
    },
    async ({ locationId, name, apiKey, accountType, isDefault, notes }) => {
      try {
        if (!isAdminScope(env)) {
          return err({ message: "Access denied: account management requires admin privileges." });
        }
        await initDb(env.GHL_DB);
        if (isDefault) {
          await env.GHL_DB.prepare(
            "UPDATE sub_accounts SET is_default = 0"
          ).run();
        }
        await env.GHL_DB.prepare(
          `INSERT OR REPLACE INTO sub_accounts (id, name, api_key, account_type, is_default, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        )
          .bind(locationId, name, apiKey, accountType, isDefault ? 1 : 0, notes || null)
          .run();
        return ok(
          `Sub-account "${name}" (${locationId}) registered!${isDefault ? " Set as default." : ""}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_sub_accounts",
    "List all registered GHL sub-accounts. API keys are masked.",
    {},
    async () => {
      try {
        await initDb(env.GHL_DB);
        const results = await env.GHL_DB.prepare(
          "SELECT id, name, account_type, is_default, notes, created_at, updated_at FROM sub_accounts ORDER BY name"
        ).all<any>();
        if (!results.results || results.results.length === 0) {
          return ok("No sub-accounts registered. Use ghl_add_sub_account to add one.");
        }
        const accounts = results.results.map((a: any) => ({
          ...a,
          is_default: a.is_default === 1 ? "YES" : "no",
        }));
        return ok(`${accounts.length} sub-account(s):\n\n${JSON.stringify(accounts, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_set_default_account",
    "Set the default sub-account by location ID or name search.",
    {
      locationId: z.string().optional().describe("Location ID"),
      name: z.string().optional().describe("Search by name (partial match)"),
    },
    async ({ locationId, name }) => {
      try {
        if (!isAdminScope(env)) {
          return err({ message: "Access denied: account management requires admin privileges." });
        }
        await initDb(env.GHL_DB);
        let account: any = null;
        if (locationId) account = await getAccountById(env.GHL_DB, locationId);
        else if (name) account = await getAccountByName(env.GHL_DB, name);
        if (!account) return err({ message: "Account not found." });
        await env.GHL_DB.prepare("UPDATE sub_accounts SET is_default = 0").run();
        await env.GHL_DB.prepare(
          "UPDATE sub_accounts SET is_default = 1, updated_at = datetime('now') WHERE id = ?"
        ).bind(account.id).run();
        return ok(`Default set to "${account.name}" (${account.id})`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_remove_sub_account",
    "Remove a sub-account from the MCP server registry.",
    { locationId: z.string().describe("Location ID to remove") },
    async ({ locationId }) => {
      try {
        if (!isAdminScope(env)) {
          return err({ message: "Access denied: account management requires admin privileges." });
        }
        await initDb(env.GHL_DB);
        const account = await getAccountById(env.GHL_DB, locationId);
        if (!account) return err({ message: "Account not found." });
        await env.GHL_DB.prepare("DELETE FROM sub_accounts WHERE id = ?")
          .bind(locationId).run();
        return ok(`Removed "${account.name}" (${locationId})`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_sub_account_token",
    "Update the API token for an existing sub-account.",
    {
      locationId: z.string().describe("Location ID to update"),
      apiKey: z.string().describe("New Private Integration Token"),
    },
    async ({ locationId, apiKey }) => {
      try {
        if (!isAdminScope(env)) {
          return err({ message: "Access denied: account management requires admin privileges." });
        }
        await initDb(env.GHL_DB);
        const account = await getAccountById(env.GHL_DB, locationId);
        if (!account) return err({ message: "Account not found." });
        await env.GHL_DB.prepare(
          "UPDATE sub_accounts SET api_key = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(apiKey, locationId).run();
        return ok(`Token updated for "${account.name}"`);
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
