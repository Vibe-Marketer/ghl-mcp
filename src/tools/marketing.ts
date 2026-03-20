import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err, resolveClient } from "./_helpers";

export function registerMarketingTools(server: McpServer, env: Env) {
  // ==========================================================
  // FUNNELS & PAGES
  // ==========================================================

  server.tool(
    "ghl_list_funnels",
    "List all funnels/websites in a location.",
    {
      type: z.string().optional().describe("Filter by type"),
      limit: z.string().optional().describe("Max results"),
      offset: z.string().optional().describe("Offset"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ type, limit, offset, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listFunnels(locationId, { type, limit, offset });
        const funnels = result.funnels || [];
        const summary = funnels.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          url: f.url,
          createdAt: f.createdAt,
        }));
        return ok(`${funnels.length} funnel(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_funnel_pages",
    "List all pages within a funnel.",
    {
      funnelId: z.string().describe("Funnel ID"),
      limit: z.string().optional().describe("Max results"),
      offset: z.string().optional().describe("Offset"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ funnelId, limit, offset, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listFunnelPages(funnelId, locationId, {
          limit,
          offset,
        });
        const pages = result.funnelPages || result.pages || [];
        const summary = pages.map((p: any) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          url: p.url,
        }));
        return ok(`${pages.length} page(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // LINKS
  // ==========================================================

  server.tool(
    "ghl_list_links",
    "List all short links in a location.",
    { locationId: z.string().optional().describe("Target location") },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listLinks(locationId);
        const links = result.links || [];
        const summary = links.map((l: any) => ({
          id: l.id,
          shortSlug: l.shortSlug,
          longUrl: l.longUrl,
          clicks: l.clicks,
          createdAt: l.createdAt,
        }));
        return ok(`${links.length} link(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_link",
    "Create a new short link.",
    {
      longUrl: z.string().describe("Long URL to shorten"),
      shortSlug: z.string().optional().describe("Custom slug (optional)"),
      title: z.string().optional().describe("Link title"),
      locationId: z.string().optional().describe("Target location"),
    },
    async (args) => {
      try {
        const client = await resolveClient(env, args.locationId);
        const result = await client.marketing.createLink(args);
        return ok(`Link created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_link",
    "Update an existing short link.",
    {
      linkId: z.string().describe("Link ID"),
      longUrl: z.string().optional(),
      shortSlug: z.string().optional(),
      title: z.string().optional(),
    },
    async ({ linkId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketing.updateLink(linkId, data);
        return ok(`Link updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_link",
    "Delete a short link.",
    { linkId: z.string().describe("Link ID") },
    async ({ linkId }) => {
      try {
        const client = await resolveClient(env);
        await client.marketing.deleteLink(linkId);
        return ok(`Link ${linkId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SOCIAL MEDIA POSTING
  // ==========================================================

  server.tool(
    "ghl_list_social_posts",
    "List social media posts with optional filters.",
    {
      type: z.string().optional().describe("Filter by post type"),
      status: z.string().optional().describe("Filter by status"),
      fromDate: z.string().optional().describe("From date (ISO 8601)"),
      toDate: z.string().optional().describe("To date (ISO 8601)"),
      accounts: z.string().optional().describe("Filter by accounts (comma-separated)"),
      limit: z.string().optional().describe("Max results"),
      skip: z.string().optional().describe("Skip (offset)"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ type, status, fromDate, toDate, accounts, limit, skip, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listSocialPosts(locationId, {
          type,
          status,
          fromDate,
          toDate,
          accounts,
          limit,
          skip,
        });
        const posts = result.posts || [];
        const summary = posts.map((p: any) => ({
          id: p.id,
          message: p.message?.substring(0, 100),
          status: p.status,
          scheduledTime: p.scheduledTime,
          createdAt: p.createdAt,
        }));
        return ok(`${posts.length} post(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_social_post",
    "Create a social media post.",
    {
      locationId: z.string().describe("Location ID"),
      message: z.string().describe("Post message"),
      accounts: z.array(z.string()).optional().describe("Social accounts to post to"),
      scheduledTime: z.string().optional().describe("Schedule time (ISO 8601)"),
      media: z.array(z.string()).optional().describe("Media URLs"),
    },
    async ({ locationId, ...data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.createSocialPost(locationId, data);
        return ok(`Social post created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_social_post",
    "Delete a social media post.",
    {
      locationId: z.string().describe("Location ID"),
      postId: z.string().describe("Post ID"),
    },
    async ({ locationId, postId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.marketing.deleteSocialPost(locationId, postId);
        return ok(`Social post ${postId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_social_accounts",
    "Get all connected social media accounts.",
    { locationId: z.string().optional().describe("Target location") },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getSocialAccounts(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_social_post",
    "Get a specific social media post.",
    {
      locationId: z.string().optional(),
      postId: z.string(),
    },
    async ({ locationId, postId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getSocialPost(locationId || client.locationId, postId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_edit_social_post",
    "Edit a social media post.",
    {
      locationId: z.string().optional(),
      postId: z.string(),
      body: z.record(z.any()),
    },
    async ({ locationId, postId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.editSocialPost(locationId || client.locationId, postId, body);
        return ok(`Social post edited!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_social_categories",
    "Get social media categories.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getSocialCategories(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_social_statistics",
    "Get social media statistics.",
    {
      body: z.record(z.any()),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketing.getSocialStatistics(body);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // EMAILS / EMAIL BUILDER
  // ==========================================================

  server.tool(
    "ghl_list_email_templates",
    "List email builder templates.",
    {
      locationId: z.string().optional(),
      search: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    },
    async ({ locationId, search, limit, offset }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listEmailTemplates(locationId, {
          search,
          limit,
          offset,
        });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_email_template",
    "Create a new email template.",
    {
      locationId: z.string().optional(),
      title: z.string().optional(),
      type: z.string(),
      importProvider: z.string(),
      body: z.record(z.any()).optional(),
    },
    async ({ locationId, title, type, importProvider, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.createEmailTemplate({
          title,
          type,
          importProvider,
          body,
          locationId: locationId || client.locationId,
        });
        return ok(`Email template created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_email_template",
    "Update an email template.",
    {
      locationId: z.string().optional(),
      templateId: z.string(),
      updatedBy: z.string(),
      html: z.string(),
      editorType: z.string(),
      dnd: z.record(z.any()),
    },
    async ({ locationId, templateId, updatedBy, html, editorType, dnd }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.updateEmailTemplate({
          templateId,
          updatedBy,
          html,
          editorType,
          dnd,
          locationId: locationId || client.locationId,
        });
        return ok(`Email template updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_email_template",
    "Delete an email template.",
    {
      locationId: z.string().optional(),
      templateId: z.string(),
    },
    async ({ locationId, templateId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.marketing.deleteEmailTemplate(locationId || client.locationId, templateId);
        return ok(`Email template ${templateId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_email_campaigns",
    "List email campaigns.",
    {
      locationId: z.string().optional(),
      status: z.string().optional(),
      name: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async ({ locationId, status, name, limit, offset }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listEmailCampaigns(locationId, {
          status,
          name,
          limit,
          offset,
        });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_verify_email",
    "Verify an email address.",
    {
      locationId: z.string().optional(),
      email: z.string(),
    },
    async ({ locationId, email }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.verifyEmail(locationId, {
          email,
        });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // EMAILS / EMAIL BUILDER (individual)
  // ==========================================================

  server.tool(
    "ghl_list_emails",
    "List email builder emails for a location.",
    {
      locationId: z.string().optional().describe("Target location"),
      limit: z.string().optional().describe("Max results"),
      offset: z.string().optional().describe("Offset"),
      search: z.string().optional().describe("Search text"),
      sortByDate: z.string().optional().describe("Sort by date"),
      archived: z.string().optional().describe("Filter archived"),
      builderVersion: z.string().optional().describe("Builder version filter"),
    },
    async ({ locationId, limit, offset, search, sortByDate, archived, builderVersion }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listEmails(locationId, { limit, offset, search, sortByDate, archived, builderVersion });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_email",
    "Get a specific email by ID.",
    {
      emailId: z.string().describe("Email ID"),
    },
    async ({ emailId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketing.getEmail(emailId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_email",
    "Create a new email in the email builder.",
    {
      data: z.record(z.any()).describe("Email data"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ data, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.createEmail({ ...data, locationId });
        return ok(`Email created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_email",
    "Update an existing email in the email builder.",
    {
      data: z.record(z.any()).describe("Updated email data"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ data, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.updateEmail({ ...data, locationId });
        return ok(`Email updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_email",
    "Delete an email from the email builder.",
    {
      locationId: z.string().describe("Location ID"),
      templateId: z.string().describe("Email template ID to delete"),
    },
    async ({ locationId, templateId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.marketing.deleteEmail(locationId, templateId);
        return ok(`Email ${templateId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // CAMPAIGNS
  // ==========================================================

  server.tool(
    "ghl_create_campaign",
    "Create a new campaign.",
    {
      data: z.record(z.any()).describe("Campaign data"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ data, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.createCampaign({ ...data, locationId });
        return ok(`Campaign created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_campaign",
    "Update an existing campaign.",
    {
      campaignId: z.string().describe("Campaign ID"),
      data: z.record(z.any()).describe("Updated campaign data"),
    },
    async ({ campaignId, data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketing.updateCampaign(campaignId, data);
        return ok(`Campaign updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_campaign",
    "Get a specific campaign by ID.",
    {
      campaignId: z.string().describe("Campaign ID"),
    },
    async ({ campaignId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketing.getCampaign(campaignId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_campaigns",
    "List campaigns for a location.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getCampaigns(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_add_contact_to_campaign",
    "Add a contact to a campaign.",
    {
      contactId: z.string(),
      campaignId: z.string(),
    },
    async ({ contactId, campaignId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketing.addContactToCampaign(contactId, campaignId);
        return ok(`Contact added to campaign!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_remove_contact_from_campaign",
    "Remove a contact from a campaign.",
    {
      contactId: z.string(),
      campaignId: z.string(),
    },
    async ({ contactId, campaignId }) => {
      try {
        const client = await resolveClient(env);
        await client.marketing.removeContactFromCampaign(contactId, campaignId);
        return ok(`Contact removed from campaign.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_remove_contact_from_all_campaigns",
    "Remove a contact from all campaigns.",
    {
      contactId: z.string(),
    },
    async ({ contactId }) => {
      try {
        const client = await resolveClient(env);
        await client.marketing.removeContactFromAllCampaigns(contactId);
        return ok(`Contact removed from all campaigns.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // TRIGGER LINKS (expanded)
  // ==========================================================

  server.tool(
    "ghl_get_link",
    "Get a specific link/trigger link by ID.",
    {
      linkId: z.string().describe("Link ID"),
    },
    async ({ linkId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketing.getLinkById(linkId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SOCIAL MEDIA CSV
  // ==========================================================

  server.tool(
    "ghl_upload_social_csv",
    "Upload a CSV file for social media posting.",
    {
      locationId: z.string().describe("Location ID"),
      body: z.record(z.any()).describe("CSV upload data"),
    },
    async ({ locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.uploadSocialCSV(locationId, body);
        return ok(`Social CSV uploaded!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_social_csv_status",
    "Get the status of a social media CSV upload.",
    {
      locationId: z.string().describe("Location ID"),
      csvId: z.string().describe("CSV upload ID"),
    },
    async ({ locationId, csvId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getSocialCSVStatus(locationId, csvId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_social_csv",
    "Delete a social media CSV upload.",
    {
      locationId: z.string().describe("Location ID"),
      csvId: z.string().describe("CSV upload ID"),
    },
    async ({ locationId, csvId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.marketing.deleteSocialCSV(locationId, csvId);
        return ok(`Social CSV ${csvId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SOCIAL MEDIA TAGS
  // ==========================================================

  server.tool(
    "ghl_list_social_tags",
    "List social media tags for a location.",
    {
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listSocialTags(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SOCIAL BULK DELETE
  // ==========================================================

  server.tool(
    "ghl_bulk_delete_social_posts",
    "Bulk delete social media posts.",
    {
      locationId: z.string().describe("Location ID"),
      body: z.record(z.any()).describe("Object with postIds array to delete"),
    },
    async ({ locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.bulkDeleteSocialPosts(locationId, body);
        return ok(`Social posts bulk deleted!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SOCIAL ACCOUNT MANAGEMENT
  // ==========================================================

  server.tool(
    "ghl_delete_social_account",
    "Delete a connected social media account.",
    {
      locationId: z.string().describe("Location ID"),
      accountId: z.string().describe("Social account ID"),
    },
    async ({ locationId, accountId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.marketing.deleteSocialAccount(locationId, accountId);
        return ok(`Social account ${accountId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // LINK SEARCH
  // ==========================================================

  server.tool(
    "ghl_search_links",
    "Search links with query and pagination.",
    {
      locationId: z.string().optional().describe("Target location"),
      query: z.string().optional().describe("Search query"),
      page: z.string().optional().describe("Page number"),
      limit: z.string().optional().describe("Max results per page"),
    },
    async ({ locationId, query, page, limit }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.searchLinks({ locationId, query, page, limit });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // EMAIL SCHEDULE
  // ==========================================================

  server.tool(
    "ghl_get_email_schedule",
    "Get the email sending schedule.",
    {},
    async () => {
      try {
        const client = await resolveClient(env);
        const result = await client.marketing.getEmailSchedule();
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SOCIAL MEDIA OAUTH START FLOWS
  // ==========================================================

  server.tool(
    "ghl_start_facebook_oauth",
    "Start Facebook OAuth flow. Returns a redirect URL for OAuth authorization.",
    {
      locationId: z.string().describe("Location ID"),
      userId: z.string().describe("User ID"),
      page: z.string().optional().describe("Page parameter"),
      reconnect: z.string().optional().describe("Reconnect flag ('true' or 'false')"),
    },
    async ({ locationId, userId, page, reconnect }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.startFacebookOAuth(locationId, userId, page, reconnect);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_start_google_oauth",
    "Start Google OAuth flow. Returns a redirect URL for OAuth authorization.",
    {
      locationId: z.string().describe("Location ID"),
      userId: z.string().describe("User ID"),
      page: z.string().optional().describe("Page parameter"),
      reconnect: z.string().optional().describe("Reconnect flag ('true' or 'false')"),
    },
    async ({ locationId, userId, page, reconnect }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.startGoogleOAuth(locationId, userId, page, reconnect);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_start_instagram_oauth",
    "Start Instagram OAuth flow. Returns a redirect URL for OAuth authorization.",
    {
      locationId: z.string().describe("Location ID"),
      userId: z.string().describe("User ID"),
      page: z.string().optional().describe("Page parameter"),
      reconnect: z.string().optional().describe("Reconnect flag ('true' or 'false')"),
    },
    async ({ locationId, userId, page, reconnect }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.startInstagramOAuth(locationId, userId, page, reconnect);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_start_linkedin_oauth",
    "Start LinkedIn OAuth flow. Returns a redirect URL for OAuth authorization.",
    {
      locationId: z.string().describe("Location ID"),
      userId: z.string().describe("User ID"),
      page: z.string().optional().describe("Page parameter"),
      reconnect: z.string().optional().describe("Reconnect flag ('true' or 'false')"),
    },
    async ({ locationId, userId, page, reconnect }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.startLinkedInOAuth(locationId, userId, page, reconnect);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_start_tiktok_oauth",
    "Start TikTok OAuth flow. Returns a redirect URL for OAuth authorization.",
    {
      locationId: z.string().describe("Location ID"),
      userId: z.string().describe("User ID"),
      page: z.string().optional().describe("Page parameter"),
      reconnect: z.string().optional().describe("Reconnect flag ('true' or 'false')"),
    },
    async ({ locationId, userId, page, reconnect }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.startTikTokOAuth(locationId, userId, page, reconnect);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_start_tiktok_business_oauth",
    "Start TikTok Business OAuth flow. Returns a redirect URL for OAuth authorization.",
    {
      locationId: z.string().describe("Location ID"),
      userId: z.string().describe("User ID"),
      page: z.string().optional().describe("Page parameter"),
      reconnect: z.string().optional().describe("Reconnect flag ('true' or 'false')"),
    },
    async ({ locationId, userId, page, reconnect }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.startTikTokBusinessOAuth(locationId, userId, page, reconnect);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_start_twitter_oauth",
    "Start Twitter/X OAuth flow. Returns a redirect URL for OAuth authorization.",
    {
      locationId: z.string().describe("Location ID"),
      userId: z.string().describe("User ID"),
      page: z.string().optional().describe("Page parameter"),
      reconnect: z.string().optional().describe("Reconnect flag ('true' or 'false')"),
    },
    async ({ locationId, userId, page, reconnect }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.startTwitterOAuth(locationId, userId, page, reconnect);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SOCIAL ACCOUNT OPERATIONS
  // ==========================================================

  server.tool(
    "ghl_attach_social_account",
    "Attach a social media account to a location.",
    {
      locationId: z.string().describe("Location ID"),
      body: z.record(z.any()).describe("Account attach data"),
    },
    async ({ locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.attachSocialAccount(locationId, body);
        return ok(`Social account attached!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_detach_social_account",
    "Detach a social media account from a location.",
    {
      locationId: z.string().describe("Location ID"),
      accountId: z.string().describe("Social account ID"),
    },
    async ({ locationId, accountId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.marketing.detachSocialAccount(locationId, accountId);
        return ok(`Social account ${accountId} detached.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_social_account_details",
    "Get details for a specific social media account.",
    {
      locationId: z.string().describe("Location ID"),
      accountId: z.string().describe("Social account ID"),
    },
    async ({ locationId, accountId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getSocialAccountDetails(locationId, accountId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SOCIAL PLANNER CATEGORY QUEUES
  // ==========================================================

  server.tool(
    "ghl_list_available_queue_categories",
    "List available Social Planner category queue categories.",
    {
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listAvailableQueueCategories();
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_category_queue",
    "Create a new Social Planner category queue.",
    {
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).describe("Queue creation data"),
    },
    async ({ locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.createCategoryQueue(body);
        return ok(`Category queue created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_category_queues",
    "List Social Planner category queues.",
    {
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).optional().describe("Filter/pagination options"),
    },
    async ({ locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listCategoryQueues(body || {});
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_category_queue",
    "Get a specific Social Planner category queue by ID.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ queueId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getCategoryQueue(queueId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_category_queue",
    "Update a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).describe("Updated queue data"),
    },
    async ({ queueId, locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.updateCategoryQueue(queueId, body);
        return ok(`Category queue updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_queue_items",
    "List items in a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).optional().describe("Filter/pagination options"),
    },
    async ({ queueId, locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.listQueueItems(queueId, body || {});
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_start_queue_edit_session",
    "Start an edit session for a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ queueId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.startQueueEditSession(queueId);
        return ok(`Edit session started!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_save_queue_edit_session",
    "Save an active edit session for a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ queueId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.saveQueueEditSession(queueId);
        return ok(`Edit session saved!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_discard_queue_edit_session",
    "Discard an active edit session for a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ queueId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.discardQueueEditSession(queueId);
        return ok(`Edit session discarded!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_queue_edit_calendar",
    "Get the calendar view for an active queue edit session.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).optional().describe("Calendar request options"),
    },
    async ({ queueId, locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getQueueEditCalendar(queueId, body || {});
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_queue_slots",
    "Get available slots for a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).optional().describe("Slot request options"),
    },
    async ({ queueId, locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getQueueSlots(queueId, body || {});
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_queue_item",
    "Delete an item from a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      itemId: z.string().describe("Item ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ queueId, itemId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.marketing.deleteQueueItem(queueId, itemId);
        return ok(`Queue item ${itemId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_queue_item",
    "Update an item in a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      itemId: z.string().describe("Item ID"),
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).describe("Updated item data"),
    },
    async ({ queueId, itemId, locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.updateQueueItem(queueId, itemId, body);
        return ok(`Queue item updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_queue_calendar",
    "Get the calendar view for a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).optional().describe("Calendar request options"),
    },
    async ({ queueId, locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getQueueCalendar(queueId, body || {});
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_active_queue_post",
    "Delete an active post from a Social Planner category queue.",
    {
      postId: z.string().describe("Post ID (used as queue ID in path)"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ postId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.marketing.deleteActiveQueuePost(postId);
        return ok(`Active queue post ${postId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_reset_queue_item",
    "Reset an item in a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      itemId: z.string().describe("Item ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ queueId, itemId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.resetQueueItem(queueId, itemId);
        return ok(`Queue item reset!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_clone_queue_item",
    "Clone an item in a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      itemId: z.string().describe("Item ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ queueId, itemId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.cloneQueueItem(queueId, itemId);
        return ok(`Queue item cloned!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_queue_item",
    "Create a new item in a Social Planner category queue.",
    {
      queueId: z.string().describe("Queue ID"),
      locationId: z.string().optional().describe("Target location"),
      body: z.record(z.any()).describe("Item creation data"),
    },
    async ({ queueId, locationId, body }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.createQueueItem(queueId, body);
        return ok(`Queue item created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_email_campaign_stats",
    "Get statistics for a specific email campaign.",
    {
      campaignId: z.string().describe("Email campaign ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ campaignId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.marketing.getEmailCampaignStats(campaignId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
