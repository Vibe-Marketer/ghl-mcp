/**
 * DISABLED — Pipeline Write Tools
 *
 * GHL's POST/PUT/DELETE /opportunities/pipelines endpoints return 401
 * ("The token is not authorized for this scope.") for all known token types:
 *   - Private Integration (PIV) tokens
 *   - Location-scoped OAuth JWTs
 *   - Agency-level PIV tokens
 *
 * These tools are NOT registered in registerOpportunitiesTools() and are
 * NOT active on the live worker. They live here so the implementation is
 * preserved and can be re-enabled if/when GHL unlocks these endpoints.
 *
 * To re-enable: copy the server.tool() blocks back into
 * src/tools/opportunities.ts and add the z import if needed.
 *
 * Last tested: 2026-03-08 — all three return 401 regardless of token.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../../types";
import { resolveClient, ok, err } from "../_helpers";

export function registerDisabledPipelineWriteTools(server: McpServer, env: Env) {
  server.tool(
    "ghl_create_pipeline",
    "Create a new sales pipeline.",
    {
      name: z.string().describe("Pipeline name"),
      stages: z.array(z.record(z.any())).optional().describe("Pipeline stages"),
      locationId: z.string().optional().describe("Target location"),
    },
    async (args) => {
      try {
        const client = await resolveClient(env, args.locationId);
        const result = await client.opportunities.createPipeline(args);
        return ok(`Pipeline created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_pipeline",
    "Update an existing pipeline.",
    {
      pipelineId: z.string().describe("Pipeline ID"),
      name: z.string().optional().describe("Updated pipeline name"),
      stages: z.array(z.record(z.any())).optional().describe("Updated pipeline stages"),
      data: z.record(z.any()).optional().describe("Additional pipeline data"),
    },
    async ({ pipelineId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.opportunities.updatePipeline(pipelineId, data);
        return ok(`Pipeline updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_pipeline",
    "Delete a pipeline by ID. WARNING: This cannot be undone.",
    {
      pipelineId: z.string().describe("Pipeline ID"),
    },
    async ({ pipelineId }) => {
      try {
        const client = await resolveClient(env);
        await client.opportunities.deletePipeline(pipelineId);
        return ok(`Pipeline ${pipelineId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
