import { BaseGHLClient } from "./base";

export function paymentMethods(client: BaseGHLClient) {
  return {
    // ========== INVOICES ==========

    async listInvoices(opts: {
      locationId?: string;
      status?: string;
      limit?: string;
      offset?: string;
      contactId?: string;
      search?: string;
      startAt?: string;
      endAt?: string;
    }) {
      const q: Record<string, string> = {
        altId: opts.locationId || client.locationId,
        altType: "location",
      };
      if (opts.status) q.status = opts.status;
      if (opts.limit) q.limit = opts.limit;
      if (opts.offset) q.offset = opts.offset;
      if (opts.contactId) q.contactId = opts.contactId;
      if (opts.search) q.search = opts.search;
      if (opts.startAt) q.startAt = opts.startAt;
      if (opts.endAt) q.endAt = opts.endAt;
      return client.request<{ invoices: any[]; total?: number }>("GET", `/invoices/`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async getInvoice(invoiceId: string, locationId?: string) {
      return client.request<{ invoice: any }>("GET", `/invoices/${invoiceId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createInvoice(data: any) {
      return client.request<{ invoice: any }>("POST", `/invoices/`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async updateInvoice(invoiceId: string, data: any) {
      return client.request<{ invoice: any }>("PUT", `/invoices/${invoiceId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteInvoice(invoiceId: string, locationId?: string) {
      return client.request<any>("DELETE", `/invoices/${invoiceId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async sendInvoice(invoiceId: string, locationId?: string) {
      return client.request<any>("POST", `/invoices/${invoiceId}/send`, {
        body: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async voidInvoice(invoiceId: string, locationId?: string) {
      return client.request<any>("POST", `/invoices/${invoiceId}/void`, {
        body: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async recordPayment(invoiceId: string, data: any) {
      return client.request<any>("POST", `/invoices/${invoiceId}/record-payment`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async recordInvoicePayment(invoiceId: string, data: any) {
      return client.request<any>("POST", `/invoices/${invoiceId}/record-payment`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async generateInvoiceNumber(locationId?: string) {
      return client.request<any>("GET", `/invoices/generate-invoice-number`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== ESTIMATES ==========

    async createEstimate(data: any) {
      return client.request<any>("POST", `/invoices/estimate`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async listEstimates(locationId?: string, opts?: { limit?: number; offset?: number }) {
      const q: Record<string, string> = {
        altId: locationId || client.locationId,
        altType: "location",
      };
      if (opts?.limit) q.limit = String(opts.limit);
      if (opts?.offset) q.offset = String(opts.offset);
      return client.request<any>("GET", `/invoices/estimate`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async sendEstimate(estimateId: string, body: any) {
      return client.request<any>("POST", `/invoices/estimate/${estimateId}/send`, {
        body,
        version: "2021-07-28",
      });
    },

    // ========== INVOICE SCHEDULES ==========

    async listInvoiceSchedules(locationId?: string) {
      return client.request<any>("GET", `/invoices/schedule`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createInvoiceSchedule(data: any) {
      return client.request<any>("POST", `/invoices/schedule`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== INVOICE TEMPLATES ==========

    async listInvoiceTemplates(locationId?: string) {
      return client.request<any>("GET", `/invoices/template`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== TEXT2PAY ==========

    async createText2Pay(data: any) {
      return client.request<any>("POST", `/invoices/text2pay`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== ORDERS ==========

    async listOrders(opts: {
      locationId?: string;
      limit?: string;
      offset?: string;
      contactId?: string;
      search?: string;
      startAt?: string;
      endAt?: string;
    }) {
      const q: Record<string, string> = {
        altId: opts.locationId || client.locationId,
        altType: "location",
      };
      if (opts.limit) q.limit = opts.limit;
      if (opts.offset) q.offset = opts.offset;
      if (opts.contactId) q.contactId = opts.contactId;
      if (opts.search) q.search = opts.search;
      if (opts.startAt) q.startAt = opts.startAt;
      if (opts.endAt) q.endAt = opts.endAt;
      return client.request<{ data: any[]; totalCount?: number }>("GET", `/payments/orders`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async getOrder(orderId: string, locationId?: string) {
      return client.request<any>("GET", `/payments/orders/${orderId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async getOrderFulfillments(orderId: string, locationId?: string) {
      return client.request<any>("GET", `/payments/orders/${orderId}/fulfillments`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createOrderFulfillment(orderId: string, body: any) {
      return client.request<any>("POST", `/payments/orders/${orderId}/fulfillments`, {
        body,
        version: "2021-07-28",
      });
    },

    // ========== TRANSACTIONS ==========

    async listTransactions(opts: {
      locationId?: string;
      limit?: string;
      offset?: string;
      contactId?: string;
      startAt?: string;
      endAt?: string;
      search?: string;
      entitySourceType?: string;
      entitySourceId?: string;
    }) {
      const q: Record<string, string> = {
        altId: opts.locationId || client.locationId,
        altType: "location",
      };
      if (opts.limit) q.limit = opts.limit;
      if (opts.offset) q.offset = opts.offset;
      if (opts.contactId) q.contactId = opts.contactId;
      if (opts.startAt) q.startAt = opts.startAt;
      if (opts.endAt) q.endAt = opts.endAt;
      if (opts.search) q.search = opts.search;
      if (opts.entitySourceType) q.entitySourceType = opts.entitySourceType;
      if (opts.entitySourceId) q.entitySourceId = opts.entitySourceId;
      return client.request<{ data: any[]; totalCount?: number }>("GET", `/payments/transactions`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async getTransaction(transactionId: string, locationId?: string) {
      return client.request<any>("GET", `/payments/transactions/${transactionId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== SUBSCRIPTIONS ==========

    async listSubscriptions(opts: {
      locationId?: string;
      limit?: string;
      offset?: string;
      contactId?: string;
      search?: string;
    }) {
      const q: Record<string, string> = {
        altId: opts.locationId || client.locationId,
        altType: "location",
      };
      if (opts.limit) q.limit = opts.limit;
      if (opts.offset) q.offset = opts.offset;
      if (opts.contactId) q.contactId = opts.contactId;
      if (opts.search) q.search = opts.search;
      return client.request<{ data: any[]; totalCount?: number }>("GET", `/payments/subscriptions`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async getSubscription(subscriptionId: string, locationId?: string) {
      return client.request<any>("GET", `/payments/subscriptions/${subscriptionId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async cancelSubscription(subscriptionId: string, data: any) {
      return client.request<any>("POST", `/payments/subscriptions/${subscriptionId}/cancel`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== STORE SETTINGS ==========

    async getStoreSettings(locationId?: string) {
      return client.request<any>("GET", `/payments/custom-provider/provider`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async updateStoreSettings(body: any) {
      return client.request<any>("PUT", `/payments/custom-provider/provider`, {
        body: { ...body, altId: body.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== STORE PRODUCTS ==========

    async listStoreProducts(locationId?: string, opts?: { limit?: string; offset?: string; search?: string }) {
      const q: Record<string, string> = { locationId: locationId || client.locationId };
      if (opts?.limit) q.limit = opts.limit;
      if (opts?.offset) q.offset = opts.offset;
      if (opts?.search) q.search = opts.search;
      return client.request<{ products: any[]; total?: number }>("GET", `/products/`, {
        query: q,
        version: "2021-07-28",
      });
    },

    async getStoreProduct(productId: string) {
      return client.request<{ product: any }>("GET", `/products/${productId}`, {
        version: "2021-07-28",
      });
    },

    async createStoreProduct(data: any) {
      return client.request<{ product: any }>("POST", `/products/`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async updateStoreProduct(productId: string, data: any) {
      return client.request<{ product: any }>("PUT", `/products/${productId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteStoreProduct(productId: string) {
      return client.request<any>("DELETE", `/products/${productId}`, {
        version: "2021-07-28",
      });
    },

    // ========== SHIPPING ==========

    async listShippingRates(shippingZoneId: string, locationId?: string) {
      return client.request<any>("GET", `/store/shipping-zone/${shippingZoneId}/shipping-rate`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async listShippingZones(locationId?: string) {
      return client.request<any>("GET", `/store/shipping-zone`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createShippingZone(data: any) {
      return client.request<any>("POST", `/store/shipping-zone`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async listShippingCarriers(locationId?: string) {
      return client.request<any>("GET", `/store/shipping-carrier`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createShippingCarrier(data: any) {
      return client.request<any>("POST", `/store/shipping-carrier`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== COUPONS ==========

    async listCoupons(locationId?: string) {
      return client.request<any>("GET", `/payments/coupons`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createCoupon(data: any) {
      return client.request<any>("POST", `/payments/coupons`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async getCoupon(couponId: string, locationId?: string) {
      return client.request<any>("GET", `/payments/coupons/${couponId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async updateCoupon(couponId: string, data: any) {
      return client.request<any>("PUT", `/payments/coupons/${couponId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteCoupon(couponId: string, locationId?: string) {
      return client.request<any>("DELETE", `/payments/coupons/${couponId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== INVOICE TEMPLATES (expanded) ==========

    async getInvoiceTemplate(templateId: string, locationId?: string) {
      return client.request<any>("GET", `/invoices/template/${templateId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createInvoiceTemplate(data: any) {
      return client.request<any>("POST", `/invoices/template`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async updateInvoiceTemplate(templateId: string, data: any) {
      return client.request<any>("PUT", `/invoices/template/${templateId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteInvoiceTemplate(templateId: string, locationId?: string) {
      return client.request<any>("DELETE", `/invoices/template/${templateId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== INVOICE SCHEDULES (expanded) ==========

    async getInvoiceSchedule(scheduleId: string, locationId?: string) {
      return client.request<any>("GET", `/invoices/schedule/${scheduleId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async updateInvoiceSchedule(scheduleId: string, data: any) {
      return client.request<any>("PUT", `/invoices/schedule/${scheduleId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteInvoiceSchedule(scheduleId: string, locationId?: string) {
      return client.request<any>("DELETE", `/invoices/schedule/${scheduleId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async manageScheduleAutoPayment(scheduleId: string, data: any) {
      return client.request<any>("POST", `/invoices/schedule/${scheduleId}/auto-payment`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async cancelScheduledInvoice(scheduleId: string, locationId?: string) {
      return client.request<any>("POST", `/invoices/schedule/${scheduleId}/cancel`, {
        body: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== ESTIMATES (expanded) ==========

    async updateEstimate(estimateId: string, data: any) {
      return client.request<any>("PUT", `/invoices/estimate/${estimateId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteEstimate(estimateId: string, locationId?: string) {
      return client.request<any>("DELETE", `/invoices/estimate/${estimateId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async generateEstimateNumber(locationId?: string) {
      return client.request<any>("GET", `/invoices/estimate/generate-number`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== ESTIMATE TEMPLATES ==========

    async listEstimateTemplates(locationId?: string) {
      return client.request<any>("GET", `/payments/custom-provider/estimate-template`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createEstimateTemplate(data: any) {
      return client.request<any>("POST", `/payments/custom-provider/estimate-template`, {
        body: { ...data, altId: data.altId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async updateEstimateTemplate(templateId: string, data: any) {
      return client.request<any>("PUT", `/payments/custom-provider/estimate-template/${templateId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteEstimateTemplate(templateId: string, locationId?: string) {
      return client.request<any>("DELETE", `/payments/custom-provider/estimate-template/${templateId}`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    // ========== INVOICE TEMPLATE CONFIGS ==========

    async updateTemplateLateFeesConfig(templateId: string, data: any) {
      return client.request<any>("PATCH", `/invoices/template/${templateId}/late-fee-config`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async updateTemplatePaymentMethodsConfig(templateId: string, data: any) {
      return client.request<any>("PATCH", `/invoices/template/${templateId}/payment-methods-config`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== INVOICE LATE FEES + STATS ==========

    async updateInvoiceLateFeesConfig(invoiceId: string, data: any) {
      return client.request<any>("PATCH", `/invoices/${invoiceId}/late-fee-config`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async updateInvoiceLastVisited() {
      return client.request<any>("POST", `/invoices/last-visited`, {
        body: {},
        version: "2021-07-28",
      });
    },

    // ========== SCHEDULE INVOICE ==========

    async scheduleInvoice(scheduleId: string, data: any) {
      return client.request<any>("POST", `/invoices/schedule/${scheduleId}/schedule`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== ORDER NOTES + PAYMENT ==========

    async listOrderNotes(orderId: string, locationId?: string) {
      return client.request<any>("GET", `/payments/orders/${orderId}/notes`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async recordOrderPayment(orderId: string, data: any) {
      return client.request<any>("POST", `/payments/orders/${orderId}/record-payment`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== CONVERT ESTIMATE ==========

    async convertEstimateToInvoice(estimateId: string) {
      return client.request<any>("POST", `/payments/custom-provider/estimate/${estimateId}/convert-to-invoice`, {
        body: {},
        version: "2021-07-28",
      });
    },

    // ========== CUSTOM PROVIDER / INTEGRATIONS ==========

    async createIntegrationProvider(data: any) {
      return client.request<any>("POST", `/payments/integrations/provider/whitelabel`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async listIntegrationProviders(locationId?: string) {
      return client.request<any>("GET", `/payments/integrations/provider/whitelabel`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createCustomIntegration(data: any) {
      return client.request<any>("POST", `/payments/custom-provider/connect`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteCustomIntegration(locationId?: string) {
      return client.request<any>("DELETE", `/payments/custom-provider/disconnect`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async getProviderConfig(locationId?: string) {
      return client.request<any>("GET", `/payments/custom-provider/provider`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },

    async createProviderConfig(data: any) {
      return client.request<any>("POST", `/payments/custom-provider/provider`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async disconnectProviderConfig(locationId?: string) {
      return client.request<any>("DELETE", `/payments/custom-provider/provider`, {
        query: { altId: locationId || client.locationId, altType: "location" },
        version: "2021-07-28",
      });
    },
  };
}
