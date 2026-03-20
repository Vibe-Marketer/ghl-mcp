import { BaseGHLClient } from "./base";

export function marketplaceMethods(client: BaseGHLClient) {
  return {
    async listAppInstallations(companyId: string) {
      return client.request<any>("GET", `/oauth/installedLocations`, {
        query: { companyId, appId: "installed" },
        version: "2021-07-28",
      });
    },

    async createBillingCharge(data: any) {
      return client.request<any>("POST", `/payments/custom-provider/charges`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getBillingCharge(chargeId: string) {
      return client.request<any>("GET", `/payments/custom-provider/charges/${chargeId}`, {
        version: "2021-07-28",
      });
    },

    async updateBillingCharge(chargeId: string, data: any) {
      return client.request<any>("PUT", `/payments/custom-provider/charges/${chargeId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteBillingCharge(chargeId: string) {
      return client.request<any>("DELETE", `/payments/custom-provider/charges/${chargeId}`, {
        version: "2021-07-28",
      });
    },

    async getAppInstallation(appId: string) {
      return client.request<any>("GET", `/app-marketplace/installations/${appId}`, {
        version: "2021-07-28",
      });
    },

    async checkHasFunds(data: any) {
      return client.request<any>("POST", `/app-marketplace/billing/has-funds`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== APP BILLING ==========

    async getRebillingConfig(companyId: string, appId: string) {
      return client.request<any>("GET", `/app-marketplace/billing/rebilling/${appId}`, {
        query: { companyId },
        version: "2021-07-28",
      });
    },

    async migrateExternalAuth(data: any) {
      return client.request<any>("POST", `/app-marketplace/external-auth/migrate`, {
        body: data,
        version: "2021-07-28",
      });
    },
  };
}
