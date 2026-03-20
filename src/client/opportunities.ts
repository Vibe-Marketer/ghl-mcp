import { BaseGHLClient } from "./base";

export function opportunityMethods(client: BaseGHLClient) {
  return {
    async searchOpportunities(opts: {
      locationId?: string;
      pipelineId?: string;
      pipelineStageId?: string;
      contactId?: string;
      status?: string;
      q?: string;
      limit?: string;
      startAfter?: string;
      startAfterId?: string;
      order?: string;
    }) {
      const q: Record<string, string> = { location_id: opts.locationId || client.locationId };
      if (opts.pipelineId) q.pipeline_id = opts.pipelineId;
      if (opts.pipelineStageId) q.pipeline_stage_id = opts.pipelineStageId;
      if (opts.contactId) q.contact_id = opts.contactId;
      if (opts.status) q.status = opts.status;
      if (opts.q) q.q = opts.q;
      if (opts.limit) q.limit = opts.limit;
      if (opts.startAfter) q.startAfter = opts.startAfter;
      if (opts.startAfterId) q.startAfterId = opts.startAfterId;
      if (opts.order) q.order = opts.order;
      return client.request<{ opportunities: any[]; meta?: any }>("GET", `/opportunities/search`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async searchOpportunitiesPost(opts: {
      locationId?: string;
      query?: string;
      limit?: number;
      page?: number;
      searchAfter?: string[];
      additionalDetails?: {
        notes?: boolean;
        tasks?: boolean;
        calendarEvents?: boolean;
        unReadConversations?: boolean;
      };
    }) {
      const body: Record<string, any> = {
        locationId: opts.locationId || client.locationId,
      };
      if (opts.query) body.query = opts.query;
      if (opts.limit !== undefined) body.limit = opts.limit;
      if (opts.page !== undefined) body.page = opts.page;
      if (opts.searchAfter) body.searchAfter = opts.searchAfter;
      if (opts.additionalDetails) body.additionalDetails = opts.additionalDetails;
      return client.request<{ opportunities: any[]; meta?: any }>("POST", `/opportunities/search`, {
        body,
        version: "2021-07-28",
      });
    },

    async getOpportunity(opportunityId: string) {
      return client.request<{ opportunity: any }>("GET", `/opportunities/${opportunityId}`, {
        version: "2021-07-28",
      });
    },

    async createOpportunity(data: {
      pipelineId: string;
      name: string;
      pipelineStageId: string;
      status?: string;
      contactId?: string;
      monetaryValue?: number;
      assignedTo?: string;
      customFields?: Array<{ id?: string; key?: string; field_value: any }>;
      locationId?: string;
    }) {
      return client.request<{ opportunity: any }>("POST", `/opportunities/`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async updateOpportunity(opportunityId: string, data: {
      pipelineId?: string;
      name?: string;
      pipelineStageId?: string;
      status?: string;
      monetaryValue?: number;
      assignedTo?: string;
      customFields?: Array<{ id?: string; key?: string; field_value: any }>;
    }) {
      return client.request<{ opportunity: any }>("PUT", `/opportunities/${opportunityId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async updateOpportunityStatus(opportunityId: string, status: string, lostReasonId?: string) {
      const body: Record<string, string> = { status };
      if (lostReasonId) body.lostReasonId = lostReasonId;
      return client.request<{ opportunity: any }>("PUT", `/opportunities/${opportunityId}/status`, {
        body,
        version: "2021-07-28",
      });
    },

    async deleteOpportunity(opportunityId: string) {
      return client.request<any>("DELETE", `/opportunities/${opportunityId}`, {
        version: "2021-07-28",
      });
    },

    async listPipelines(locationId?: string) {
      return client.request<{ pipelines: any[] }>("GET", `/opportunities/pipelines`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async getPipeline(pipelineId: string, locationId?: string) {
      return client.request<{ pipeline: any }>("GET", `/opportunities/pipelines/${pipelineId}`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async createPipeline(data: any) {
      return client.request<{ pipeline: any }>("POST", `/opportunities/pipelines`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async updatePipeline(pipelineId: string, data: any) {
      return client.request<{ pipeline: any }>("PUT", `/opportunities/pipelines/${pipelineId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deletePipeline(pipelineId: string) {
      return client.request<any>("DELETE", `/opportunities/pipelines/${pipelineId}`, {
        version: "2021-07-28",
      });
    },

    async upsertOpportunity(data: {
      id?: string;
      pipelineId: string;
      name: string;
      pipelineStageId: string;
      status?: string;
      monetaryValue?: number;
      assignedTo?: string;
      followers?: string;
      followersActionType?: string;
      isRemoveAllFollowers?: boolean;
      lostReasonId?: string;
      locationId?: string;
    }) {
      return client.request<any>("POST", `/opportunities/upsert`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async addOpportunityFollowers(opportunityId: string, data: any) {
      return client.request<any>("POST", `/opportunities/${opportunityId}/followers`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async removeOpportunityFollowers(opportunityId: string, data: any) {
      return client.request<any>("DELETE", `/opportunities/${opportunityId}/followers`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== LOST REASON ==========

    async getLostReason(pipelineId: string, locationId?: string) {
      return client.request<any>("GET", `/opportunities/pipelines/${pipelineId}/lost-reason`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },
  };
}
