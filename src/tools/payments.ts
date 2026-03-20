import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err, resolveClient } from "./_helpers";

export function registerPaymentsTools(server: McpServer, env: Env) {
  // ==========================================================
  // INVOICES
  // ==========================================================

  server.tool(
    "ghl_list_invoices",
    "List invoices with optional filters: status, contactId, search, date range.",
    {
      status: z.string().optional().describe("Filter by status"),
      contactId: z.string().optional().describe("Filter by contact ID"),
      search: z.string().optional().describe("Search text"),
      startAt: z.string().optional().describe("Start date (ISO 8601)"),
      endAt: z.string().optional().describe("End date (ISO 8601)"),
      limit: z.string().optional().describe("Max results"),
      offset: z.string().optional().describe("Offset for pagination"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ status, contactId, search, startAt, endAt, limit, offset, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listInvoices({
          locationId,
          status,
          contactId,
          search,
          startAt,
          endAt,
          limit,
          offset,
        });
        const invoices = result.invoices || [];
        const summary = invoices.map((i: any) => ({
          id: i.id,
          number: i.number,
          contactName: i.contactName,
          total: i.total,
          status: i.status,
          dueDate: i.dueDate,
          createdAt: i.createdAt,
        }));
        return ok(`${invoices.length} invoice(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_invoice",
    "Get full details for a specific invoice.",
    {
      invoiceId: z.string().describe("Invoice ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ invoiceId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getInvoice(invoiceId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_invoice",
    "Create a new invoice.",
    {
      contactId: z.string().describe("Contact ID"),
      total: z.number().optional().describe("Total amount"),
      dueDate: z.string().optional().describe("Due date (ISO 8601)"),
      description: z.string().optional().describe("Invoice description"),
      lineItems: z.array(z.any()).optional().describe("Line items array"),
      locationId: z.string().optional().describe("Target location"),
    },
    async (args) => {
      try {
        const client = await resolveClient(env, args.locationId);
        const result = await client.payments.createInvoice(args);
        return ok(`Invoice created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_invoice",
    "Update an existing invoice.",
    {
      invoiceId: z.string().describe("Invoice ID"),
      total: z.number().optional(),
      dueDate: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
    },
    async ({ invoiceId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateInvoice(invoiceId, data);
        return ok(`Invoice updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_invoice",
    "Delete an invoice by ID.",
    {
      invoiceId: z.string().describe("Invoice ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ invoiceId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.payments.deleteInvoice(invoiceId, locationId);
        return ok(`Invoice ${invoiceId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_send_invoice",
    "Send an invoice to the contact via email.",
    {
      invoiceId: z.string().describe("Invoice ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ invoiceId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.sendInvoice(invoiceId, locationId);
        return ok(`Invoice sent!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_void_invoice",
    "Mark an invoice as void.",
    {
      invoiceId: z.string().describe("Invoice ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ invoiceId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.voidInvoice(invoiceId, locationId);
        return ok(`Invoice voided!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_record_invoice_payment",
    "Record a payment against an invoice.",
    {
      invoiceId: z.string().describe("Invoice ID"),
      amount: z.number().describe("Payment amount"),
      paymentDate: z.string().optional().describe("Payment date (ISO 8601)"),
      paymentMethod: z.string().optional().describe("Payment method"),
    },
    async ({ invoiceId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.recordInvoicePayment(invoiceId, data);
        return ok(`Payment recorded!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_generate_invoice_number",
    "Generate a new invoice number.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.generateInvoiceNumber(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_estimate",
    "Create a new estimate.",
    {
      body: z.record(z.any()),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createEstimate(body);
        return ok(`Estimate created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_estimates",
    "List estimates.",
    {
      locationId: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async ({ locationId, limit, offset }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listEstimates(locationId, { limit, offset });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_send_estimate",
    "Send an estimate.",
    {
      estimateId: z.string(),
      body: z.record(z.any()),
    },
    async ({ estimateId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.sendEstimate(estimateId, body);
        return ok(`Estimate sent!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_invoice_schedules",
    "List invoice schedules.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listInvoiceSchedules(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_invoice_schedule",
    "Create an invoice schedule.",
    {
      body: z.record(z.any()),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createInvoiceSchedule(body);
        return ok(`Invoice schedule created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_invoice_templates",
    "List invoice templates.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listInvoiceTemplates(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_text2pay",
    "Create and send a text-to-pay invoice.",
    {
      body: z.record(z.any()),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createText2Pay(body);
        return ok(`Text-to-pay invoice created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // PAYMENTS - ORDERS
  // ==========================================================

  server.tool(
    "ghl_list_orders",
    "List orders with optional filters.",
    {
      contactId: z.string().optional().describe("Filter by contact ID"),
      search: z.string().optional().describe("Search text"),
      startAt: z.string().optional().describe("Start date (ISO 8601)"),
      endAt: z.string().optional().describe("End date (ISO 8601)"),
      limit: z.string().optional().describe("Max results"),
      offset: z.string().optional().describe("Offset"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ contactId, search, startAt, endAt, limit, offset, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listOrders({
          locationId,
          contactId,
          search,
          startAt,
          endAt,
          limit,
          offset,
        });
        const orders = result.data || [];
        const summary = orders.map((o: any) => ({
          id: o.id,
          contactId: o.contactId,
          total: o.total,
          status: o.status,
          createdAt: o.createdAt,
        }));
        return ok(`${orders.length} order(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_order",
    "Get full details for a specific order.",
    {
      orderId: z.string().describe("Order ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ orderId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getOrder(orderId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_order_fulfillments",
    "Get order fulfillments.",
    {
      orderId: z.string(),
      locationId: z.string().optional(),
    },
    async ({ orderId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getOrderFulfillments(orderId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_order_fulfillment",
    "Create an order fulfillment.",
    {
      orderId: z.string(),
      body: z.record(z.any()),
    },
    async ({ orderId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createOrderFulfillment(orderId, body);
        return ok(`Order fulfillment created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // PAYMENTS - TRANSACTIONS
  // ==========================================================

  server.tool(
    "ghl_list_transactions",
    "List payment transactions with optional filters.",
    {
      contactId: z.string().optional().describe("Filter by contact ID"),
      search: z.string().optional().describe("Search text"),
      startAt: z.string().optional().describe("Start date (ISO 8601)"),
      endAt: z.string().optional().describe("End date (ISO 8601)"),
      entitySourceType: z.string().optional().describe("Filter by entity source type"),
      entitySourceId: z.string().optional().describe("Filter by entity source ID"),
      limit: z.string().optional().describe("Max results"),
      offset: z.string().optional().describe("Offset"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({
      contactId,
      search,
      startAt,
      endAt,
      entitySourceType,
      entitySourceId,
      limit,
      offset,
      locationId,
    }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listTransactions({
          locationId,
          contactId,
          search,
          startAt,
          endAt,
          entitySourceType,
          entitySourceId,
          limit,
          offset,
        });
        const transactions = result.data || [];
        const summary = transactions.map((t: any) => ({
          id: t.id,
          contactId: t.contactId,
          amount: t.amount,
          type: t.type,
          status: t.status,
          createdAt: t.createdAt,
        }));
        return ok(`${transactions.length} transaction(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_transaction",
    "Get a specific transaction.",
    {
      transactionId: z.string(),
      locationId: z.string().optional(),
    },
    async ({ transactionId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getTransaction(transactionId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // PAYMENTS - SUBSCRIPTIONS
  // ==========================================================

  server.tool(
    "ghl_list_subscriptions",
    "List active subscriptions with optional filters.",
    {
      contactId: z.string().optional().describe("Filter by contact ID"),
      search: z.string().optional().describe("Search text"),
      limit: z.string().optional().describe("Max results"),
      offset: z.string().optional().describe("Offset"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ contactId, search, limit, offset, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listSubscriptions({
          locationId,
          contactId,
          search,
          limit,
          offset,
        });
        const subs = result.data || [];
        const summary = subs.map((s: any) => ({
          id: s.id,
          contactId: s.contactId,
          productName: s.productName,
          status: s.status,
          nextBillingDate: s.nextBillingDate,
          createdAt: s.createdAt,
        }));
        return ok(`${subs.length} subscription(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_subscription",
    "Get full details for a specific subscription.",
    {
      subscriptionId: z.string().describe("Subscription ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ subscriptionId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getSubscription(subscriptionId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SUBSCRIPTIONS - CANCEL
  // ==========================================================

  server.tool(
    "ghl_cancel_subscription",
    "Cancel an active subscription.",
    {
      subscriptionId: z.string().describe("Subscription ID"),
      data: z.record(z.any()).optional().describe("Cancellation data (reason, etc.)"),
    },
    async ({ subscriptionId, data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.cancelSubscription(subscriptionId, data || {});
        return ok(`Subscription cancelled!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // STORE / SHIPPING
  // ==========================================================

  server.tool(
    "ghl_get_store_settings",
    "Get store settings for a location.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getStoreSettings(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_shipping_carriers",
    "List shipping carriers.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listShippingCarriers(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_shipping_zones",
    "List shipping zones.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listShippingZones(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_shipping_carrier",
    "Create a shipping carrier.",
    {
      body: z.record(z.any()),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createShippingCarrier(body);
        return ok(`Shipping carrier created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_shipping_zone",
    "Create a shipping zone.",
    {
      body: z.record(z.any()),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createShippingZone(body);
        return ok(`Shipping zone created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_store_settings",
    "Update store settings.",
    {
      body: z.record(z.any()),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateStoreSettings(body);
        return ok(`Store settings updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_shipping_rates",
    "List shipping rates for a zone.",
    {
      shippingZoneId: z.string(),
      locationId: z.string().optional(),
    },
    async ({ shippingZoneId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listShippingRates(shippingZoneId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // PAYMENT - COUPONS
  // ==========================================================

  server.tool(
    "ghl_list_coupons",
    "List payment coupons.",
    {
      locationId: z.string().optional(),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listCoupons(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_coupon",
    "Create a payment coupon.",
    {
      body: z.record(z.any()),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createCoupon(body);
        return ok(`Coupon created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_coupon",
    "Get a specific coupon by ID.",
    {
      couponId: z.string().describe("Coupon ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ couponId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getCoupon(couponId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_coupon",
    "Update an existing coupon.",
    {
      couponId: z.string().describe("Coupon ID"),
      body: z.record(z.any()).describe("Updated coupon data"),
    },
    async ({ couponId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateCoupon(couponId, body);
        return ok(`Coupon updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_coupon",
    "Delete a coupon by ID.",
    {
      couponId: z.string().describe("Coupon ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ couponId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.payments.deleteCoupon(couponId, locationId);
        return ok(`Coupon ${couponId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // INVOICE TEMPLATES (expanded)
  // ==========================================================

  server.tool(
    "ghl_get_invoice_template",
    "Get a specific invoice template by ID.",
    {
      templateId: z.string().describe("Invoice template ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ templateId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getInvoiceTemplate(templateId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_invoice_template",
    "Create a new invoice template.",
    {
      body: z.record(z.any()).describe("Invoice template data"),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createInvoiceTemplate(body);
        return ok(`Invoice template created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_invoice_template",
    "Update an existing invoice template.",
    {
      templateId: z.string().describe("Invoice template ID"),
      body: z.record(z.any()).describe("Updated template data"),
    },
    async ({ templateId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateInvoiceTemplate(templateId, body);
        return ok(`Invoice template updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_invoice_template",
    "Delete an invoice template by ID.",
    {
      templateId: z.string().describe("Invoice template ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ templateId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.payments.deleteInvoiceTemplate(templateId, locationId);
        return ok(`Invoice template ${templateId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // INVOICE SCHEDULES (expanded)
  // ==========================================================

  server.tool(
    "ghl_get_invoice_schedule",
    "Get a specific invoice schedule by ID.",
    {
      scheduleId: z.string().describe("Invoice schedule ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ scheduleId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getInvoiceSchedule(scheduleId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_invoice_schedule",
    "Update an existing invoice schedule.",
    {
      scheduleId: z.string().describe("Invoice schedule ID"),
      body: z.record(z.any()).describe("Updated schedule data"),
    },
    async ({ scheduleId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateInvoiceSchedule(scheduleId, body);
        return ok(`Invoice schedule updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_invoice_schedule",
    "Delete an invoice schedule by ID.",
    {
      scheduleId: z.string().describe("Invoice schedule ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ scheduleId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.payments.deleteInvoiceSchedule(scheduleId, locationId);
        return ok(`Invoice schedule ${scheduleId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_manage_schedule_auto_payment",
    "Manage auto-payment settings for an invoice schedule.",
    {
      scheduleId: z.string().describe("Invoice schedule ID"),
      body: z.record(z.any()).describe("Auto-payment configuration"),
    },
    async ({ scheduleId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.manageScheduleAutoPayment(scheduleId, body);
        return ok(`Auto-payment updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_cancel_scheduled_invoice",
    "Cancel a scheduled invoice.",
    {
      scheduleId: z.string().describe("Invoice schedule ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ scheduleId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.cancelScheduledInvoice(scheduleId, locationId);
        return ok(`Scheduled invoice cancelled!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // ESTIMATES (expanded)
  // ==========================================================

  server.tool(
    "ghl_update_estimate",
    "Update an existing estimate.",
    {
      estimateId: z.string().describe("Estimate ID"),
      body: z.record(z.any()).describe("Updated estimate data"),
    },
    async ({ estimateId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateEstimate(estimateId, body);
        return ok(`Estimate updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_estimate",
    "Delete an estimate by ID.",
    {
      estimateId: z.string().describe("Estimate ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ estimateId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.payments.deleteEstimate(estimateId, locationId);
        return ok(`Estimate ${estimateId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_generate_estimate_number",
    "Generate a new estimate number.",
    {
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.generateEstimateNumber(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // ESTIMATE TEMPLATES
  // ==========================================================

  server.tool(
    "ghl_list_estimate_templates",
    "List estimate templates.",
    {
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listEstimateTemplates(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_estimate_template",
    "Create an estimate template.",
    {
      body: z.record(z.any()).describe("Estimate template data"),
    },
    async ({ body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.createEstimateTemplate(body);
        return ok(`Estimate template created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_estimate_template",
    "Update an existing estimate template.",
    {
      templateId: z.string().describe("Estimate template ID"),
      body: z.record(z.any()).describe("Updated template data"),
    },
    async ({ templateId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateEstimateTemplate(templateId, body);
        return ok(`Estimate template updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_estimate_template",
    "Delete an estimate template by ID.",
    {
      templateId: z.string().describe("Estimate template ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ templateId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        await client.payments.deleteEstimateTemplate(templateId, locationId);
        return ok(`Estimate template ${templateId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // INVOICE TEMPLATE CONFIGS
  // ==========================================================

  server.tool(
    "ghl_update_template_late_fees_config",
    "Update late fees configuration for an invoice template.",
    {
      templateId: z.string().describe("Invoice template ID"),
      body: z.record(z.any()).describe("Late fees config data"),
    },
    async ({ templateId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateTemplateLateFeesConfig(templateId, body);
        return ok(`Template late fees config updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_template_payment_methods_config",
    "Update payment methods configuration for an invoice template.",
    {
      templateId: z.string().describe("Invoice template ID"),
      body: z.record(z.any()).describe("Payment methods config data"),
    },
    async ({ templateId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateTemplatePaymentMethodsConfig(templateId, body);
        return ok(`Template payment methods config updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // INVOICE LATE FEES + STATS
  // ==========================================================

  server.tool(
    "ghl_update_invoice_late_fees_config",
    "Update late fees configuration for a specific invoice.",
    {
      invoiceId: z.string().describe("Invoice ID"),
      body: z.record(z.any()).describe("Late fees config data"),
    },
    async ({ invoiceId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateInvoiceLateFeesConfig(invoiceId, body);
        return ok(`Invoice late fees config updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_invoice_last_visited",
    "Update the last visited timestamp for invoices.",
    {},
    async () => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.updateInvoiceLastVisited();
        return ok(`Invoice last visited updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // SCHEDULE INVOICE
  // ==========================================================

  server.tool(
    "ghl_schedule_invoice",
    "Schedule an invoice from an invoice schedule.",
    {
      scheduleId: z.string().describe("Invoice schedule ID"),
      body: z.record(z.any()).describe("Schedule data"),
    },
    async ({ scheduleId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.scheduleInvoice(scheduleId, body);
        return ok(`Invoice scheduled!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // ORDER NOTES + PAYMENT
  // ==========================================================

  server.tool(
    "ghl_list_order_notes",
    "List notes for a specific order.",
    {
      orderId: z.string().describe("Order ID"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ orderId, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listOrderNotes(orderId, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_record_order_payment",
    "Record a payment against an order.",
    {
      orderId: z.string().describe("Order ID"),
      body: z.record(z.any()).describe("Payment data"),
    },
    async ({ orderId, body }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.recordOrderPayment(orderId, body);
        return ok(`Order payment recorded!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // CONVERT ESTIMATE
  // ==========================================================

  server.tool(
    "ghl_convert_estimate_to_invoice",
    "Convert an estimate to an invoice.",
    {
      estimateId: z.string().describe("Estimate ID"),
    },
    async ({ estimateId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.payments.convertEstimateToInvoice(estimateId);
        return ok(`Estimate converted to invoice!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ==========================================================
  // CUSTOM PROVIDER / INTEGRATIONS
  // ==========================================================

  server.tool(
    "ghl_create_integration_provider",
    "Create a whitelabel payment integration provider.",
    {
      body: z.record(z.any()).describe("Integration provider data"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ body, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.createIntegrationProvider(body);
        return ok(`Integration provider created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_integration_providers",
    "List whitelabel payment integration providers for a location.",
    {
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.listIntegrationProviders(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_custom_integration",
    "Connect a custom payment integration for a location.",
    {
      body: z.record(z.any()).describe("Custom integration data"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ body, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.createCustomIntegration(body);
        return ok(`Custom integration connected!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_custom_integration",
    "Disconnect a custom payment integration for a location.",
    {
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.deleteCustomIntegration(locationId);
        return ok(`Custom integration disconnected!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_provider_config",
    "Get the custom payment provider configuration for a location.",
    {
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.getProviderConfig(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_provider_config",
    "Create a custom payment provider configuration.",
    {
      body: z.record(z.any()).describe("Provider config data"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ body, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.createProviderConfig(body);
        return ok(`Provider config created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_disconnect_provider_config",
    "Disconnect and delete the custom payment provider configuration for a location.",
    {
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.payments.disconnectProviderConfig(locationId);
        return ok(`Provider config disconnected!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
