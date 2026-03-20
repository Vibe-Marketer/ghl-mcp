import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err, resolveClient } from "./_helpers";

export function registerSaaSTools(server: McpServer, env: Env) {
  server.tool(
    "ghl_saas_list_locations",
    "List SaaS locations for a company.",
    {
      companyId: z.string(),
      limit: z.string().optional(),
      skip: z.string().optional(),
      query: z.string().optional(),
    },
    async ({ companyId, limit, skip, query }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.saas.listSaaSLocations(companyId, { limit, skip, query });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_get_location",
    "Get a SaaS location by ID.",
    {
      locationId: z.string(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.saas.getSaaSLocation(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_enable",
    "Enable SaaS for a location.",
    {
      locationId: z.string(),
      data: z.record(z.any()),
    },
    async ({ locationId, data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.saas.enableSaaS(locationId, data);
        return ok(`SaaS enabled!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_pause",
    "Pause SaaS for a location.",
    {
      locationId: z.string(),
      data: z.record(z.any()),
    },
    async ({ locationId, data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.saas.pauseSaaS(locationId, data);
        return ok(`SaaS paused!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_bulk_enable",
    "Bulk enable SaaS for multiple locations.",
    {
      data: z.record(z.any()),
    },
    async ({ data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.saas.bulkEnableSaaS(data);
        return ok(`SaaS bulk enabled!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_bulk_disable",
    "Bulk disable SaaS for multiple locations.",
    {
      data: z.record(z.any()),
    },
    async ({ data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.saas.bulkDisableSaaS(data);
        return ok(`SaaS bulk disabled!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_update_rebilling",
    "Update SaaS rebilling configuration.",
    {
      data: z.record(z.any()),
    },
    async ({ data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.saas.updateRebilling(data);
        return ok(`Rebilling updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_update_subscription",
    "Update SaaS subscription for a location.",
    {
      locationId: z.string(),
      data: z.record(z.any()),
    },
    async ({ locationId, data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.saas.updateSaaSSubscription(locationId, data);
        return ok(`SaaS subscription updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_get_agency_plans",
    "Get agency plans for SaaS.",
    {},
    async () => {
      try {
        const client = await resolveClient(env);
        const result = await client.saas.getAgencyPlans();
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_get_plan",
    "Get the SaaS plan for a location.",
    {
      locationId: z.string(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.saas.getSaaSPlan(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_get_subscription",
    "Get the SaaS subscription for a location.",
    {
      locationId: z.string(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.saas.getSaaSSubscription(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_get_wallet_balance",
    "Get the wallet balance for a SaaS location.",
    {
      locationId: z.string().describe("Location ID"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.saas.getLocationWalletBalance(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_saas_update_wallet_balance",
    "Update the wallet balance for a SaaS location.",
    {
      locationId: z.string().describe("Location ID"),
      data: z.record(z.any()).describe("Wallet balance update data"),
    },
    async ({ locationId, data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.saas.updateLocationWalletBalance(locationId, data);
        return ok(`Wallet balance updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
