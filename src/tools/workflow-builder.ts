/**
 * Workflow Builder Tools — Internal GHL API
 * Uses backend.leadconnectorhq.com with Firebase JWT auth
 * These tools are INDEPENDENT of the existing GHLClient/resolveClient system.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err } from "./_helpers";
import { workflowBuilderMethods } from "../client/workflow-builder";

function getBuilderClient(env: Env, locationId?: string) {
  const refreshToken = (env as any).GHL_FIREBASE_REFRESH_TOKEN;
  const staticToken = (env as any).GHL_FIREBASE_TOKEN;

  if (!refreshToken && !staticToken) {
    throw new Error(
      "Neither GHL_FIREBASE_REFRESH_TOKEN nor GHL_FIREBASE_TOKEN is set. At least one is required for workflow builder operations."
    );
  }

  const loc = locationId || env.GHL_LOCATION_ID;
  if (!loc) {
    throw new Error(
      "No locationId provided and no default GHL_LOCATION_ID set."
    );
  }

  return workflowBuilderMethods({
    firebaseToken: staticToken || "",
    refreshToken: refreshToken,
    kv: env.OAUTH_KV, // reuse existing KV namespace for token caching
    locationId: loc,
  });
}

export function registerWorkflowBuilderTools(server: McpServer, env: Env) {
  // ==========================================================
  // LIST WORKFLOWS
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_list",
    "List all workflows and folders in a location (internal API). Returns names, IDs, status, and folder structure.",
    {
      parentId: z
        .string()
        .optional()
        .describe('Parent folder ID (default: "root")'),
      type: z
        .string()
        .optional()
        .describe('Filter by type: "workflow" or "directory"'),
      limit: z.number().optional().describe("Max results (default 50)"),
      offset: z.number().optional().describe("Offset for pagination"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ parentId, type, limit, offset, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const result = await client.listWorkflows({
          parentId,
          type,
          limit,
          offset,
        });
        const rows = result.rows || [];
        const summary = rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.type || "workflow",
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        return ok(
          `${rows.length} item(s)${result.total ? ` (total: ${result.total})` : ""}:\n\n${JSON.stringify(summary, null, 2)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // CREATE WORKFLOW
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_create",
    "Create a new workflow in the location (internal API).",
    {
      name: z.string().describe("Workflow name"),
      parentId: z
        .string()
        .optional()
        .describe("Parent folder ID (omit for root)"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ name, parentId, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const result = await client.createWorkflow(name, parentId);
        return ok(
          `Workflow created successfully.\n\nID: ${result.id || JSON.stringify(result)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // GET WORKFLOW
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_get",
    "Get workflow details and metadata (internal API). Returns name, status, version, trigger info, but not the action steps.",
    {
      workflowId: z.string().describe("Workflow ID"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ workflowId, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const result = await client.getWorkflow(workflowId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // GET WORKFLOW STEPS
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_get_steps",
    "Get the actual action steps (templates) of a workflow from Firebase storage. Shows the full workflow action chain.",
    {
      workflowId: z.string().describe("Workflow ID"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ workflowId, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const data = await client.getWorkflowData(workflowId);
        const templates = data.templates || [];
        if (templates.length === 0) {
          return ok("No action steps found in this workflow.");
        }
        const formatted = templates.map((t: any, i: number) => {
          const lines = [`Step ${i + 1}: [${t.type || "unknown"}] ${t.name || "Unnamed"}`];
          if (t.next) lines.push(`  -> next: ${t.next}`);
          if (t.attributes) {
            lines.push(`  attributes: ${JSON.stringify(t.attributes, null, 4).split("\n").join("\n  ")}`);
          }
          return lines.join("\n");
        });
        return ok(
          `${templates.length} step(s):\n\n${formatted.join("\n\n")}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // GET WORKFLOW TRIGGERS
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_get_triggers",
    "Get trigger configurations for a workflow from Firebase storage.",
    {
      workflowId: z.string().describe("Workflow ID"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ workflowId, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const triggers = await client.getWorkflowTriggers(workflowId);
        if (!triggers || triggers.length === 0) {
          return ok("No triggers found for this workflow.");
        }
        return ok(
          `${triggers.length} trigger(s):\n\n${JSON.stringify(triggers, null, 2)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // UPDATE WORKFLOW
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_update",
    "Update workflow name or settings (internal API). Requires the current version number to prevent conflicts.",
    {
      workflowId: z.string().describe("Workflow ID"),
      version: z
        .number()
        .describe(
          "Current workflow version (required — get it from ghl_workflow_builder_get)"
        ),
      name: z.string().optional().describe("New workflow name"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ workflowId, version, name, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const data: Record<string, any> = { version };
        if (name) data.name = name;
        const result = await client.updateWorkflow(workflowId, data as any);
        return ok(
          `Workflow updated successfully.\n\n${JSON.stringify(result, null, 2)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SAVE WORKFLOW STEPS
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_save_steps",
    "Save action steps (templates array) to a workflow. Requires version number. The templates param is a JSON string of the templates array.",
    {
      workflowId: z.string().describe("Workflow ID"),
      version: z
        .number()
        .describe("Current workflow version (required for conflict prevention)"),
      templates: z
        .string()
        .describe(
          "JSON string of the templates (action steps) array to save"
        ),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ workflowId, version, templates, locationId }) => {
      try {
        let parsed: any[];
        try {
          parsed = JSON.parse(templates);
          if (!Array.isArray(parsed)) {
            throw new Error("templates must be a JSON array");
          }
        } catch (parseErr: any) {
          return err(
            new Error(`Invalid templates JSON: ${parseErr.message}`)
          );
        }

        const client = getBuilderClient(env, locationId);
        const result = await client.updateWorkflow(workflowId, {
          version,
          workflowData: { templates: parsed },
        });
        return ok(
          `Saved ${parsed.length} step(s) to workflow.\n\n${JSON.stringify(result, null, 2)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // PUBLISH WORKFLOW
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_publish",
    "Publish a workflow (set status to published).",
    {
      workflowId: z.string().describe("Workflow ID"),
      updatedBy: z
        .string()
        .describe("User ID who is publishing (GHL user ID)"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ workflowId, updatedBy, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const result = await client.changeWorkflowStatus(
          workflowId,
          "published",
          updatedBy
        );
        return ok(
          `Workflow published successfully.\n\n${JSON.stringify(result, null, 2)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // DRAFT WORKFLOW
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_draft",
    "Set a workflow back to draft status.",
    {
      workflowId: z.string().describe("Workflow ID"),
      updatedBy: z
        .string()
        .describe("User ID who is setting to draft (GHL user ID)"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ workflowId, updatedBy, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const result = await client.changeWorkflowStatus(
          workflowId,
          "draft",
          updatedBy
        );
        return ok(
          `Workflow set to draft.\n\n${JSON.stringify(result, null, 2)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // DELETE WORKFLOW
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_delete",
    "Delete a workflow permanently (internal API).",
    {
      workflowId: z.string().describe("Workflow ID to delete"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ workflowId, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const result = await client.deleteWorkflow(workflowId);
        return ok(`Workflow deleted.\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // CREATE TRIGGER
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_create_trigger",
    "Create a trigger for a workflow (internal API).",
    {
      workflowId: z.string().describe("Workflow ID to attach trigger to"),
      type: z
        .string()
        .describe(
          'Trigger type (e.g. "contact_created", "tag_added", "form_submitted", etc.)'
        ),
      name: z.string().describe("Trigger display name"),
      active: z
        .boolean()
        .optional()
        .describe("Whether trigger is active (default true)"),
      conditions: z
        .string()
        .optional()
        .describe("JSON string of conditions array"),
      actions: z
        .string()
        .optional()
        .describe("JSON string of actions array"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({
      workflowId,
      type,
      name,
      active,
      conditions,
      actions,
      locationId,
    }) => {
      try {
        let parsedConditions: any[] | undefined;
        let parsedActions: any[] | undefined;

        if (conditions) {
          try {
            parsedConditions = JSON.parse(conditions);
          } catch (e: any) {
            return err(new Error(`Invalid conditions JSON: ${e.message}`));
          }
        }
        if (actions) {
          try {
            parsedActions = JSON.parse(actions);
          } catch (e: any) {
            return err(new Error(`Invalid actions JSON: ${e.message}`));
          }
        }

        const client = getBuilderClient(env, locationId);
        const result = await client.createTrigger({
          type,
          name,
          active: active !== false,
          workflowId,
          conditions: parsedConditions,
          actions: parsedActions,
        });
        return ok(
          `Trigger created.\n\nID: ${result.id || JSON.stringify(result)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // UPDATE TRIGGER
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_update_trigger",
    "Update an existing trigger (internal API).",
    {
      triggerId: z.string().describe("Trigger ID to update"),
      data: z
        .string()
        .describe("JSON string of trigger data to update"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ triggerId, data, locationId }) => {
      try {
        let parsed: any;
        try {
          parsed = JSON.parse(data);
        } catch (e: any) {
          return err(new Error(`Invalid data JSON: ${e.message}`));
        }

        const client = getBuilderClient(env, locationId);
        const result = await client.updateTrigger(triggerId, parsed);
        return ok(
          `Trigger updated.\n\n${JSON.stringify(result, null, 2)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // DELETE TRIGGER
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_delete_trigger",
    "Delete a trigger from a workflow (internal API).",
    {
      triggerId: z.string().describe("Trigger ID to delete"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ triggerId, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const result = await client.deleteTrigger(triggerId);
        return ok(`Trigger deleted.\n\n${JSON.stringify(result)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // CREATE FOLDER
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_create_folder",
    "Create a workflow folder (internal API).",
    {
      name: z.string().describe("Folder name"),
      parentId: z
        .string()
        .optional()
        .describe("Parent folder ID (omit for root)"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ name, parentId, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const result = await client.createFolder(name, parentId);
        return ok(
          `Folder created.\n\nID: ${result.id || JSON.stringify(result)}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // CLONE WORKFLOW
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_clone",
    "Clone a workflow by reading its steps and creating a new workflow with the same action chain. Generates new UUIDs for each step.",
    {
      sourceWorkflowId: z.string().describe("Source workflow ID to clone"),
      newName: z.string().describe("Name for the cloned workflow"),
      parentId: z
        .string()
        .optional()
        .describe("Parent folder ID for the clone"),
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ sourceWorkflowId, newName, parentId, locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);

        // 1. Get source workflow data (steps)
        const sourceData = await client.getWorkflowData(sourceWorkflowId);
        const sourceTemplates = sourceData.templates || [];

        // 2. Create new workflow
        const created = await client.createWorkflow(newName, parentId);
        const newId =
          created.id ||
          (created as any).workflowId ||
          (created as any)._id;

        if (!newId) {
          return err(
            new Error(
              `Failed to get new workflow ID from creation response: ${JSON.stringify(created)}`
            )
          );
        }

        // 3. Generate new UUIDs for steps and remap references
        if (sourceTemplates.length > 0) {
          const idMap = new Map<string, string>();
          for (const t of sourceTemplates) {
            if (t.id) {
              idMap.set(t.id, crypto.randomUUID());
            }
          }

          const clonedTemplates = sourceTemplates.map((t: any) => {
            const cloned = { ...t };
            if (cloned.id && idMap.has(cloned.id)) {
              cloned.id = idMap.get(cloned.id);
            }
            if (cloned.next && idMap.has(cloned.next)) {
              cloned.next = idMap.get(cloned.next);
            }
            return cloned;
          });

          // 4. Get the new workflow to obtain its version
          const newWf = await client.getWorkflow(newId);
          const version = newWf.version || 1;

          // 5. Save cloned steps
          await client.updateWorkflow(newId, {
            version,
            workflowData: { templates: clonedTemplates },
          });
        }

        return ok(
          `Workflow cloned successfully.\n\nSource: ${sourceWorkflowId}\nNew ID: ${newId}\nName: ${newName}\nSteps copied: ${sourceTemplates.length}`
        );
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // ERROR COUNT
  // ==========================================================

  server.tool(
    "ghl_workflow_builder_error_count",
    "Get the workflow error notification count for a location.",
    {
      locationId: z.string().optional().describe("Target location ID"),
    },
    async ({ locationId }) => {
      try {
        const client = getBuilderClient(env, locationId);
        const count = await client.getErrorCount();
        return ok(`Workflow error count: ${count}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
