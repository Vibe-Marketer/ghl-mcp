import { BaseGHLClient } from "./base";

export function saasMethods(client: BaseGHLClient) {
  return {
    async listSaaSLocations(companyId: string, params?: { limit?: string; skip?: string; query?: string }) {
      const q: Record<string, string> = { companyId };
      if (params?.limit) q.limit = params.limit;
      if (params?.skip) q.skip = params.skip;
      if (params?.query) q.query = params.query;
      return client.request<any>("GET", `/saas-api/public-api/locations`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async getSaaSLocation(locationId: string) {
      return client.request<any>("GET", `/saas-api/public-api/locations/${locationId}`, {
        version: "2021-07-28",
      });
    },

    async enableSaaS(locationId: string, data: any) {
      return client.request<any>("POST", `/saas-api/public-api/enable-saas/${locationId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async pauseSaaS(locationId: string, data: any) {
      return client.request<any>("POST", `/saas-api/public-api/pause/${locationId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async bulkEnableSaaS(data: any) {
      return client.request<any>("POST", `/saas-api/public-api/bulk-enable-saas`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async bulkDisableSaaS(data: any) {
      return client.request<any>("POST", `/saas-api/public-api/bulk-disable-saas`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async updateRebilling(data: any) {
      return client.request<any>("POST", `/saas-api/public-api/update-rebilling`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async updateSaaSSubscription(locationId: string, data: any) {
      return client.request<any>("PUT", `/saas-api/public-api/update-saas-subscription/${locationId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getAgencyPlans() {
      return client.request<any>("GET", `/saas-api/public-api/agency-plans`, {
        version: "2021-07-28",
      });
    },

    async getSaaSPlan(locationId: string) {
      return client.request<any>("GET", `/saas-api/public-api/plan`, {
        query: { locationId },
        version: "2021-07-28",
      });
    },

    async getSaaSSubscription(locationId: string) {
      return client.request<any>("GET", `/saas-api/public-api/subscription`, {
        query: { locationId },
        version: "2021-07-28",
      });
    },

    // ========== WALLET BALANCE ==========

    async getLocationWalletBalance(locationId: string) {
      return client.request<any>("GET", `/saas-api/public-api/wallet-balance`, {
        query: { locationId },
        version: "2021-07-28",
      });
    },

    async updateLocationWalletBalance(locationId: string, data: any) {
      return client.request<any>("POST", `/saas-api/public-api/wallet-balance`, {
        body: { ...data, locationId },
        version: "2021-07-28",
      });
    },
  };
}
