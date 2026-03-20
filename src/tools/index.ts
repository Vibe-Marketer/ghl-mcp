import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../types";

import { registerAccountsTools } from "./accounts";
import { registerCalendarsTools } from "./calendars";
import { registerContactsTools } from "./contacts";
import { registerConversationsTools } from "./conversations";
import { registerOpportunitiesTools } from "./opportunities";
import { registerPaymentsTools } from "./payments";
import { registerMarketingTools } from "./marketing";
import { registerAutomationTools } from "./automation";
import { registerAIAgentsTools } from "./ai-agents";
import { registerLocationTools } from "./locations";
import { registerContentTools } from "./content";
import { registerMiscTools } from "./misc";
import { registerBusinessesTools } from "./businesses";
import { registerSaaSTools } from "./saas";
import { registerMarketplaceTools } from "./marketplace";
import { registerKnowledgeBaseTools } from "./knowledge-base";
import { registerErrorTools } from "./errors";
import { registerWorkflowBuilderTools } from "./workflow-builder";

export function registerAllTools(server: McpServer, env: Env) {
  registerAccountsTools(server, env);
  registerCalendarsTools(server, env);
  registerContactsTools(server, env);
  registerConversationsTools(server, env);
  registerOpportunitiesTools(server, env);
  registerPaymentsTools(server, env);
  registerMarketingTools(server, env);
  registerAutomationTools(server, env);
  registerAIAgentsTools(server, env);
  registerLocationTools(server, env);
  registerContentTools(server, env);
  registerMiscTools(server, env);
  registerBusinessesTools(server, env);
  registerSaaSTools(server, env);
  registerMarketplaceTools(server, env);
  registerKnowledgeBaseTools(server, env);
  registerErrorTools(server, env);
  registerWorkflowBuilderTools(server, env);
}
