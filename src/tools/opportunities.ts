import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err, resolveClient } from "./_helpers";

export function registerOpportunitiesTools(server: McpServer, env: Env) {
  server.tool(
    "ghl_search_opportunities",
    "Search opportunities with optional filters: pipelineId, pipelineStageId, contactId, status, search text. Uses GET method for simple queries.",
    {
      pipelineId: z.string().optional().describe("Filter by pipeline ID"),
      pipelineStageId: z.string().optional().describe("Filter by pipeline stage ID"),
      contactId: z.string().optional().describe("Filter by contact ID"),
      status: z.string().optional().describe("Filter by status"),
      q: z.string().optional().describe("Search text"),
      limit: z.string().optional().describe("Max results"),
      locationId: z.string().optional().describe("Target location"),
      additionalDetails: z.object({
        notes: z.boolean().optional().describe("Include notes"),
        tasks: z.boolean().optional().describe("Include tasks"),
        calendarEvents: z.boolean().optional().describe("Include calendar events"),
        unReadConversations: z.boolean().optional().describe("Include unread conversations"),
      }).optional().describe("Request additional details (notes, tasks, calendarEvents, unReadConversations). When provided, uses POST search for richer results."),
      page: z.number().optional().describe("Page number (only with additionalDetails/POST search)"),
    },
    async ({ pipelineId, pipelineStageId, contactId, status, q, limit, locationId, additionalDetails, page }) => {
      try {
        const client = await resolveClient(env, locationId);

        // Use POST search when additionalDetails are requested
        if (additionalDetails) {
          const result = await client.opportunities.searchOpportunitiesPost({
            locationId,
            query: q || contactId || pipelineId,
            limit: limit ? parseInt(limit) : undefined,
            page,
            additionalDetails,
          });
          const opps = result.opportunities || [];
          if (opps.length === 0) return ok("No opportunities found.");
          return ok(`${opps.length} opportunity(ies):\n\n${JSON.stringify(opps, null, 2)}`);
        }

        // Default GET search
        const result = await client.opportunities.searchOpportunities({
          locationId,
          pipelineId,
          pipelineStageId,
          contactId,
          status,
          q,
          limit,
        });
        const opps = result.opportunities || [];
        if (opps.length === 0) return ok("No opportunities found.");
        const summary = opps.map((o: any) => ({
          id: o.id,
          name: o.name,
          monetaryValue: o.monetaryValue,
          status: o.status,
          pipelineId: o.pipelineId,
          pipelineStageId: o.pipelineStageId,
          contactId: o.contactId,
          assignedTo: o.assignedTo,
          createdAt: o.createdAt,
        }));
        return ok(`${opps.length} opportunity(ies):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_opportunity",
    "Get full details for a specific opportunity by ID.",
    { opportunityId: z.string().describe("Opportunity ID") },
    async ({ opportunityId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.opportunities.getOpportunity(opportunityId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_opportunity",
    "Create a new sales opportunity.",
    {
      name: z.string().describe("Opportunity name"),
      pipelineId: z.string().describe("Pipeline ID"),
      pipelineStageId: z.string().describe("Pipeline stage ID"),
      contactId: z.string().optional().describe("Associated contact ID"),
      monetaryValue: z.number().optional().describe("Deal monetary value"),
      assignedTo: z.string().optional().describe("User ID to assign the opportunity to"),
      status: z.string().optional().describe("Status (open, won, lost, abandoned)"),
      customFields: z.array(z.object({
        id: z.string().optional().describe("Custom field ID"),
        key: z.string().optional().describe("Custom field key"),
        field_value: z.unknown().describe("Custom field value (string, array, or object)"),
      })).optional().describe("Custom field values"),
      locationId: z.string().optional().describe("Target location"),
    },
    async (args) => {
      try {
        const client = await resolveClient(env, args.locationId);
        const result = await client.opportunities.createOpportunity(args as any);
        return ok(`Opportunity created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_opportunity",
    "Update an existing opportunity.",
    {
      opportunityId: z.string().describe("Opportunity ID"),
      pipelineId: z.string().optional().describe("Move to different pipeline"),
      name: z.string().optional().describe("Updated name"),
      pipelineStageId: z.string().optional().describe("Move to different pipeline stage"),
      status: z.string().optional().describe("Status (open, won, lost, abandoned)"),
      monetaryValue: z.number().optional().describe("Deal monetary value"),
      assignedTo: z.string().optional().describe("User ID to assign to"),
      customFields: z.array(z.object({
        id: z.string().optional().describe("Custom field ID"),
        key: z.string().optional().describe("Custom field key"),
        field_value: z.unknown().describe("Custom field value (string, array, or object)"),
      })).optional().describe("Custom field values to update"),
    },
    async ({ opportunityId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.opportunities.updateOpportunity(opportunityId, data as any);
        return ok(`Opportunity updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_opportunity",
    "Delete an opportunity by ID.",
    { opportunityId: z.string().describe("Opportunity ID") },
    async ({ opportunityId }) => {
      try {
        const client = await resolveClient(env);
        await client.opportunities.deleteOpportunity(opportunityId);
        return ok(`Opportunity ${opportunityId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_opportunity_status",
    "Update the status of an opportunity (open, won, lost, abandoned).",
    {
      opportunityId: z.string().describe("Opportunity ID"),
      status: z.string().describe("New status (open, won, lost, abandoned)"),
      lostReasonId: z.string().optional().describe("Lost reason ID (required when status is 'lost')"),
    },
    async ({ opportunityId, status, lostReasonId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.opportunities.updateOpportunityStatus(opportunityId, status, lostReasonId);
        return ok(`Opportunity status updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_pipelines",
    "List all sales pipelines in a location.",
    { locationId: z.string().optional().describe("Target location") },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.opportunities.listPipelines(locationId);
        const pipelines = result.pipelines || [];
        const summary = pipelines.map((p: any) => ({
          id: p.id,
          name: p.name,
          stages: p.stages?.length || 0,
          archived: p.archived,
        }));
        return ok(`${pipelines.length} pipeline(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_pipeline",
    "Get full details for a specific pipeline including its stages.",
    {
      pipelineId: z.string().describe("Pipeline ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ pipelineId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.opportunities.getPipeline(pipelineId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== PIPELINE MANAGEMENT ==========

  // ghl_create_pipeline, ghl_update_pipeline, ghl_delete_pipeline are DISABLED.
  // GHL returns 401 for all pipeline write endpoints regardless of token type.
  // Implementations preserved in src/tools/_disabled/pipeline-write.ts
  // Last tested: 2026-03-17 — all three still return 401.

  // ========== UPSERT OPPORTUNITY ==========

  server.tool(
    "ghl_upsert_opportunity",
    "Create or update an opportunity. Matches by pipeline and contact -- creates if not found, updates if found.",
    {
      id: z.string().optional().describe("Opportunity ID (for updating a specific opportunity)"),
      name: z.string().describe("Opportunity name"),
      pipelineId: z.string().describe("Pipeline ID"),
      pipelineStageId: z.string().describe("Pipeline stage ID"),
      contactId: z.string().optional().describe("Associated contact ID"),
      monetaryValue: z.number().optional().describe("Deal monetary value"),
      assignedTo: z.string().optional().describe("User ID to assign to"),
      status: z.string().optional().describe("Status (open, won, lost, abandoned)"),
      followers: z.string().optional().describe("User ID to add/remove as follower"),
      followersActionType: z.enum(["add", "remove"]).optional().describe("Whether to add or remove followers"),
      isRemoveAllFollowers: z.boolean().optional().describe("Remove all existing followers"),
      lostReasonId: z.string().optional().describe("Lost reason ID (when status is 'lost')"),
      locationId: z.string().optional().describe("Target location"),
    },
    async (args) => {
      try {
        const client = await resolveClient(env, args.locationId);
        const result = await client.opportunities.upsertOpportunity(args);
        return ok(`Opportunity upserted!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== OPPORTUNITY FOLLOWERS ==========

  server.tool(
    "ghl_add_opportunity_followers",
    "Add followers to an opportunity.",
    {
      opportunityId: z.string().describe("Opportunity ID"),
      followers: z.array(z.string()).describe("User IDs to add as followers"),
    },
    async ({ opportunityId, followers }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.opportunities.addOpportunityFollowers(opportunityId, { followers });
        return ok(`Followers added!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_remove_opportunity_followers",
    "Remove followers from an opportunity.",
    {
      opportunityId: z.string().describe("Opportunity ID"),
      followers: z.array(z.string()).describe("User IDs to remove as followers"),
    },
    async ({ opportunityId, followers }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.opportunities.removeOpportunityFollowers(opportunityId, { followers });
        return ok(`Followers removed!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_lost_reason",
    "Get the lost reason configuration for a pipeline.",
    {
      pipelineId: z.string().describe("Pipeline ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ pipelineId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.opportunities.getLostReason(pipelineId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
