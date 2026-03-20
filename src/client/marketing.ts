import { BaseGHLClient } from "./base";

export function marketingMethods(client: BaseGHLClient) {
  return {
    // ========== CAMPAIGNS ==========

    async listCampaigns(locationId?: string) {
      return client.request<any>("GET", `/campaigns/`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async getCampaigns(locationId?: string) {
      return client.request<any>("GET", `/campaigns/`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async createCampaign(data: any) {
      return client.request<any>("POST", `/campaigns/`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async updateCampaign(campaignId: string, data: any) {
      return client.request<any>("PUT", `/campaigns/${campaignId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getCampaign(campaignId: string) {
      return client.request<any>("GET", `/campaigns/${campaignId}`, {
        version: "2021-07-28",
      });
    },

    async addContactToCampaign(contactId: string, campaignId: string) {
      return client.request<any>("POST", `/contacts/${contactId}/campaigns/${campaignId}`, {
        version: "2021-07-28",
      });
    },

    async removeContactFromCampaign(contactId: string, campaignId: string) {
      return client.request<any>("DELETE", `/contacts/${contactId}/campaigns/${campaignId}`, {
        version: "2021-07-28",
      });
    },

    async removeContactFromAllCampaigns(contactId: string) {
      return client.request<any>("DELETE", `/contacts/${contactId}/campaigns/removeAll`, {
        version: "2021-07-28",
      });
    },

    // ========== SOCIAL MEDIA ==========

    async listSocialPosts(locationId?: string, opts?: {
      type?: string; status?: string; fromDate?: string; toDate?: string;
      accounts?: string; limit?: string; skip?: string;
    }) {
      const locId = locationId || client.locationId;
      const q: Record<string, string> = {};
      if (opts?.type) q.type = opts.type;
      if (opts?.status) q.status = opts.status;
      if (opts?.fromDate) q.fromDate = opts.fromDate;
      if (opts?.toDate) q.toDate = opts.toDate;
      if (opts?.accounts) q.accounts = opts.accounts;
      if (opts?.limit) q.limit = opts.limit;
      if (opts?.skip) q.skip = opts.skip;
      return client.request<{ posts: any[] }>("GET", `/social-media-posting/${locId}/posts`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async createSocialPost(locationId: string, data: any) {
      const locId = locationId || client.locationId;
      return client.request<any>("POST", `/social-media-posting/${locId}/posts`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getSocialPost(locationId: string, postId: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("GET", `/social-media-posting/${locId}/posts/${postId}`, {
        version: "2021-07-28",
      });
    },

    async editSocialPost(locationId: string, postId: string, body: any) {
      const locId = locationId || client.locationId;
      return client.request<any>("PUT", `/social-media-posting/${locId}/posts/${postId}`, {
        body,
        version: "2021-07-28",
      });
    },

    async deleteSocialPost(locationId: string, postId: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("DELETE", `/social-media-posting/${locId}/posts/${postId}`, {
        version: "2021-07-28",
      });
    },

    async getSocialAccounts(locationId?: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("GET", `/social-media-posting/${locId}/oauth/accounts`, {
        version: "2021-07-28",
      });
    },

    async listSocialCategories(locationId?: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("GET", `/social-media-posting/${locId}/categories`, {
        version: "2021-07-28",
      });
    },

    async getSocialCategories(locationId?: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("GET", `/social-media-posting/${locId}/categories`, {
        version: "2021-07-28",
      });
    },

    async getSocialStatistics(data: any) {
      return client.request<any>("POST", `/social-media-posting/statistics`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== EMAIL BUILDER ==========

    async listEmails(locationId?: string, params?: { limit?: string; offset?: string; search?: string; sortByDate?: string; archived?: string; builderVersion?: string }) {
      const q: Record<string, string> = { locationId: locationId || client.locationId };
      if (params?.limit) q.limit = params.limit;
      if (params?.offset) q.offset = params.offset;
      if (params?.search) q.search = params.search;
      if (params?.sortByDate) q.sortByDate = params.sortByDate;
      if (params?.archived) q.archived = params.archived;
      if (params?.builderVersion) q.builderVersion = params.builderVersion;
      return client.request<any>("GET", `/emails/builder`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async getEmail(emailId: string) {
      return client.request<any>("GET", `/emails/${emailId}`, {
        version: "2021-07-28",
      });
    },

    async createEmail(data: any) {
      return client.request<any>("POST", `/emails/builder`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async updateEmail(data: any) {
      return client.request<any>("POST", `/emails/builder/data`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async deleteEmail(locationId: string, templateId: string) {
      return client.request<any>("DELETE", `/emails/builder/${locationId}/${templateId}`, {
        version: "2021-07-28",
      });
    },

    // ========== EMAIL TEMPLATES ==========

    async listEmailTemplates(locationId?: string, opts?: { search?: string; limit?: string; offset?: string }) {
      const q: Record<string, string> = { locationId: locationId || client.locationId };
      if (opts?.search) q.search = opts.search;
      if (opts?.limit) q.limit = opts.limit;
      if (opts?.offset) q.offset = opts.offset;
      return client.request<any>("GET", `/emails/builder/templates`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async createEmailTemplate(data: any) {
      return client.request<any>("POST", `/emails/builder/templates`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async updateEmailTemplate(data: any) {
      return client.request<any>("PUT", `/emails/builder/templates`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async deleteEmailTemplate(locationId: string, templateId: string) {
      return client.request<any>("DELETE", `/emails/builder/templates/${templateId}`, {
        query: { locationId },
        version: "2021-07-28",
      });
    },

    // ========== EMAIL CAMPAIGNS ==========

    async listEmailCampaigns(locationId?: string, opts?: { status?: string; name?: string; limit?: number; offset?: number }) {
      const q: Record<string, string> = { locationId: locationId || client.locationId };
      if (opts?.status) q.status = opts.status;
      if (opts?.name) q.name = opts.name;
      if (opts?.limit) q.limit = String(opts.limit);
      if (opts?.offset) q.offset = String(opts.offset);
      return client.request<any>("GET", `/campaigns/email`, {
        query: q,
        version: "2021-07-28",
      });
    },

    // ========== EMAIL VERIFICATION ==========

    async verifyEmail(locationId?: string, data?: { email: string }) {
      return client.request<any>("POST", `/emails/verify`, {
        body: { ...data, locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    // ========== FUNNELS ==========

    async listFunnels(locationId?: string, opts?: { limit?: string; offset?: string; type?: string }) {
      const q: Record<string, string> = { locationId: locationId || client.locationId };
      if (opts?.limit) q.limit = opts.limit;
      if (opts?.offset) q.offset = opts.offset;
      if (opts?.type) q.type = opts.type;
      return client.request<{ funnels: any[]; count?: number; total?: number }>("GET", `/funnels/funnel/list`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async listFunnelPages(funnelId: string, locationId?: string, opts?: { limit?: string; offset?: string }) {
      const q: Record<string, string> = { locationId: locationId || client.locationId };
      if (opts?.limit) q.limit = opts.limit;
      if (opts?.offset) q.offset = opts.offset;
      return client.request<any>("GET", `/funnels/page`, {
        query: { ...q, funnelId },
        version: "2021-07-28",
      });
    },

    // ========== LINKS ==========

    async listLinks(locationId?: string) {
      return client.request<{ links: any[] }>("GET", `/links/`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async createLink(data: any) {
      return client.request<{ link: any }>("POST", `/links/`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async updateLink(linkId: string, data: any) {
      return client.request<{ link: any }>("PUT", `/links/${linkId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteLink(linkId: string) {
      return client.request<any>("DELETE", `/links/${linkId}`, {
        version: "2021-07-28",
      });
    },

    // ========== TRIGGER LINKS (expanded) ==========

    async getLinkById(linkId: string) {
      return client.request<any>("GET", `/links/${linkId}`, {
        version: "2021-07-28",
      });
    },

    // ========== SOCIAL MEDIA CSV ==========

    async uploadSocialCSV(locationId: string, data: any) {
      const locId = locationId || client.locationId;
      return client.request<any>("POST", `/social-media-posting/${locId}/csv`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getSocialCSVStatus(locationId: string, csvId: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("GET", `/social-media-posting/${locId}/csv/${csvId}`, {
        version: "2021-07-28",
      });
    },

    async deleteSocialCSV(locationId: string, csvId: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("DELETE", `/social-media-posting/${locId}/csv/${csvId}`, {
        version: "2021-07-28",
      });
    },

    // ========== SOCIAL MEDIA TAGS ==========

    async listSocialTags(locationId?: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("GET", `/social-media-posting/${locId}/tags`, {
        version: "2021-07-28",
      });
    },

    // ========== SOCIAL BULK DELETE ==========

    async bulkDeleteSocialPosts(locationId: string, data: any) {
      const locId = locationId || client.locationId;
      return client.request<any>("POST", `/social-media-posting/${locId}/posts/bulk-delete`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== SOCIAL ACCOUNT MANAGEMENT ==========

    async deleteSocialAccount(locationId: string, accountId: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("DELETE", `/social-media-posting/${locId}/oauth/${accountId}`, {
        version: "2021-07-28",
      });
    },

    // ========== LINK SEARCH ==========

    async searchLinks(params: { locationId?: string; query?: string; page?: string; limit?: string }) {
      const q: Record<string, string> = {};
      if (params.locationId) q.locationId = params.locationId;
      else if (client.locationId) q.locationId = client.locationId;
      if (params.query) q.query = params.query;
      if (params.page) q.page = params.page;
      if (params.limit) q.limit = params.limit;
      return client.request<any>("GET", `/links/search`, {
        query: q,
        version: "2021-07-28",
      });
    },

    // ========== EMAIL SCHEDULE ==========

    async getEmailSchedule() {
      return client.request<any>("GET", `/emails/schedule`, {
        version: "2021-07-28",
      });
    },

    // ========== SOCIAL MEDIA OAUTH START FLOWS ==========

    async startFacebookOAuth(locationId: string, userId: string, page?: string, reconnect?: string) {
      const q: Record<string, string> = { locationId, userId };
      if (page) q.page = page;
      if (reconnect) q.reconnect = reconnect;
      return client.request<any>("GET", `/social-media-posting/oauth/facebook/start`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async startGoogleOAuth(locationId: string, userId: string, page?: string, reconnect?: string) {
      const q: Record<string, string> = { locationId, userId };
      if (page) q.page = page;
      if (reconnect) q.reconnect = reconnect;
      return client.request<any>("GET", `/social-media-posting/oauth/google/start`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async startInstagramOAuth(locationId: string, userId: string, page?: string, reconnect?: string) {
      const q: Record<string, string> = { locationId, userId };
      if (page) q.page = page;
      if (reconnect) q.reconnect = reconnect;
      return client.request<any>("GET", `/social-media-posting/oauth/instagram/start`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async startLinkedInOAuth(locationId: string, userId: string, page?: string, reconnect?: string) {
      const q: Record<string, string> = { locationId, userId };
      if (page) q.page = page;
      if (reconnect) q.reconnect = reconnect;
      return client.request<any>("GET", `/social-media-posting/oauth/linkedin/start`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async startTikTokOAuth(locationId: string, userId: string, page?: string, reconnect?: string) {
      const q: Record<string, string> = { locationId, userId };
      if (page) q.page = page;
      if (reconnect) q.reconnect = reconnect;
      return client.request<any>("GET", `/social-media-posting/oauth/tiktok/start`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async startTikTokBusinessOAuth(locationId: string, userId: string, page?: string, reconnect?: string) {
      const q: Record<string, string> = { locationId, userId };
      if (page) q.page = page;
      if (reconnect) q.reconnect = reconnect;
      return client.request<any>("GET", `/social-media-posting/oauth/tiktok-business/start`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async startTwitterOAuth(locationId: string, userId: string, page?: string, reconnect?: string) {
      const q: Record<string, string> = { locationId, userId };
      if (page) q.page = page;
      if (reconnect) q.reconnect = reconnect;
      return client.request<any>("GET", `/social-media-posting/oauth/twitter/start`, {
        query: q,
        version: "2021-07-28",
      });
    },

    // ========== SOCIAL ACCOUNT OPERATIONS ==========

    async attachSocialAccount(locationId: string, data: any) {
      const locId = locationId || client.locationId;
      return client.request<any>("POST", `/social-media-posting/${locId}/accounts/attach`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async detachSocialAccount(locationId: string, accountId: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("DELETE", `/social-media-posting/${locId}/accounts/${accountId}/detach`, {
        version: "2021-07-28",
      });
    },

    async getSocialAccountDetails(locationId: string, accountId: string) {
      const locId = locationId || client.locationId;
      return client.request<any>("GET", `/social-media-posting/${locId}/accounts/${accountId}`, {
        version: "2021-07-28",
      });
    },

    // ========== CATEGORY QUEUE ==========

    async listAvailableQueueCategories() {
      return client.request<any>("GET", `/social-media-posting/category/queues/available-categories`, {
        version: "2021-07-28",
      });
    },

    async createCategoryQueue(data: any) {
      return client.request<any>("POST", `/social-media-posting/category/queues`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async listCategoryQueues(data: any = {}) {
      return client.request<any>("POST", `/social-media-posting/category/queues/list`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getCategoryQueue(queueId: string) {
      return client.request<any>("GET", `/social-media-posting/category/queues/${queueId}`, {
        version: "2021-07-28",
      });
    },

    async updateCategoryQueue(queueId: string, data: any) {
      return client.request<any>("PUT", `/social-media-posting/category/queues/${queueId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async listQueueItems(queueId: string, data: any = {}) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/items`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async startQueueEditSession(queueId: string) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/edit/start`, {
        body: {},
        version: "2021-07-28",
      });
    },

    async saveQueueEditSession(queueId: string) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/edit/save`, {
        body: {},
        version: "2021-07-28",
      });
    },

    async discardQueueEditSession(queueId: string) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/edit/discard`, {
        body: {},
        version: "2021-07-28",
      });
    },

    async getQueueEditCalendar(queueId: string, data: any = {}) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/edit/calendar`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getQueueSlots(queueId: string, data: any = {}) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/slots`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteQueueItem(queueId: string, itemId: string) {
      return client.request<any>("DELETE", `/social-media-posting/category/queues/${queueId}/items/${itemId}`, {
        version: "2021-07-28",
      });
    },

    async updateQueueItem(queueId: string, itemId: string, data: any) {
      return client.request<any>("PUT", `/social-media-posting/category/queues/${queueId}/items/${itemId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getQueueCalendar(queueId: string, data: any = {}) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/calendar`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteActiveQueuePost(postId: string) {
      return client.request<any>("DELETE", `/social-media-posting/category/queues/${postId}/active-post`, {
        version: "2021-07-28",
      });
    },

    async resetQueueItem(queueId: string, itemId: string) {
      return client.request<any>("PUT", `/social-media-posting/category/queues/${queueId}/items/${itemId}/reset`, {
        body: {},
        version: "2021-07-28",
      });
    },

    async cloneQueueItem(queueId: string, itemId: string) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/items/${itemId}/clone`, {
        body: {},
        version: "2021-07-28",
      });
    },

    async createQueueItem(queueId: string, data: any) {
      return client.request<any>("POST", `/social-media-posting/category/queues/${queueId}/create/item`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== EMAIL STATISTICS ==========

    async getEmailCampaignStats(campaignId: string, locationId?: string) {
      return client.request<any>("GET", `/emails/campaign/${campaignId}/stats`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },
  };
}
