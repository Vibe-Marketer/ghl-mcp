import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err, resolveClient } from "./_helpers";

export function registerMarketplaceTools(server: McpServer, env: Env) {
  server.tool(
    "ghl_marketplace_list_app_installations",
    "List installed app locations for a company.",
    {
      companyId: z.string(),
    },
    async ({ companyId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketplace.listAppInstallations(companyId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_marketplace_create_billing_charge",
    "Create a billing charge for a marketplace app.",
    {
      data: z.record(z.any()),
    },
    async ({ data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketplace.createBillingCharge(data);
        return ok(`Billing charge created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_marketplace_get_billing_charge",
    "Get a billing charge by ID.",
    {
      chargeId: z.string(),
    },
    async ({ chargeId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketplace.getBillingCharge(chargeId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_marketplace_update_billing_charge",
    "Update a billing charge.",
    {
      chargeId: z.string(),
      data: z.record(z.any()),
    },
    async ({ chargeId, data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketplace.updateBillingCharge(chargeId, data);
        return ok(`Billing charge updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_marketplace_delete_billing_charge",
    "Delete a billing charge.",
    {
      chargeId: z.string(),
    },
    async ({ chargeId }) => {
      try {
        const client = await resolveClient(env);
        await client.marketplace.deleteBillingCharge(chargeId);
        return ok(`Billing charge ${chargeId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_marketplace_get_app_installation",
    "Get an app installation by app ID.",
    {
      appId: z.string(),
    },
    async ({ appId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketplace.getAppInstallation(appId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_marketplace_check_has_funds",
    "Check if a marketplace account has funds.",
    {
      data: z.record(z.any()),
    },
    async ({ data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketplace.checkHasFunds(data);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_marketplace_get_rebilling_config",
    "Get the rebilling configuration for a marketplace app.",
    {
      companyId: z.string().describe("Company ID"),
      appId: z.string().describe("App ID"),
    },
    async ({ companyId, appId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketplace.getRebillingConfig(companyId, appId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_marketplace_migrate_external_auth",
    "Migrate external authentication data for a marketplace app.",
    {
      data: z.record(z.any()).describe("External auth migration data"),
    },
    async ({ data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketplace.migrateExternalAuth(data);
        return ok(`External auth migrated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
