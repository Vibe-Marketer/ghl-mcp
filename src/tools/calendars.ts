import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { ok, err, resolveClient } from "./_helpers";

export function registerCalendarsTools(server: McpServer, env: Env) {
  server.tool(
    "ghl_list_calendars",
    "List all calendars in a GHL location. Shows name, ID, type, and status.",
    { locationId: z.string().optional().describe("Target location (uses default if omitted)") },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.listCalendars(locationId);
        const summary = (result.calendars || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          calendarType: c.calendarType,
          eventType: c.eventType,
          isActive: c.isActive,
          slotDuration: `${c.slotDuration} ${c.slotDurationUnit}`,
        }));
        return ok(`${summary.length} calendar(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_calendar",
    "Get full details for a specific calendar by ID.",
    { calendarId: z.string().describe("Calendar ID") },
    async ({ calendarId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getCalendar(calendarId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_calendar_free_slots",
    "Get available booking slots for a calendar in a date range.",
    {
      calendarId: z.string().describe("Calendar ID"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      timezone: z.string().optional().describe("Timezone (e.g. America/New_York)"),
    },
    async ({ calendarId, startDate, endDate, timezone }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getCalendarFreeSlots(calendarId, startDate, endDate, timezone);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_calendar_events",
    "List appointments/events for a calendar within a date range. Provide dates as ISO 8601 strings — they are converted to epoch millis automatically.",
    {
      calendarId: z.string().describe("Calendar ID"),
      startTime: z.string().describe("Start time (ISO 8601 e.g. 2026-02-13T00:00:00Z, or epoch millis)"),
      endTime: z.string().describe("End time (ISO 8601 e.g. 2026-02-20T23:59:59Z, or epoch millis)"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ calendarId, startTime, endTime, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        // Convert ISO dates to epoch millis if needed (GHL requires millis)
        const toMillis = (t: string) => {
          if (/^\d+$/.test(t)) return t; // already millis
          return String(new Date(t).getTime());
        };
        const result = await client.calendars.listCalendarEvents(
          calendarId,
          toMillis(startTime),
          toMillis(endTime),
          locationId
        );
        const events = result.events || [];
        if (events.length === 0) return ok("No events found in this date range.");
        const summary = events.map((e: any) => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
          status: e.appointmentStatus,
          contactId: e.contactId,
          calendarId: e.calendarId,
          assignedUserId: e.assignedUserId,
          address: e.address,
          notes: e.notes,
        }));
        return ok(`${events.length} event(s):\n\n${JSON.stringify(summary, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_appointment",
    "Get full details for a specific appointment by ID.",
    { eventId: z.string().describe("Appointment/event ID") },
    async ({ eventId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getAppointment(eventId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_appointment",
    "Book a new appointment on a calendar for a contact.",
    {
      calendarId: z.string().describe("Calendar ID to book on"),
      contactId: z.string().describe("Contact ID for the appointment"),
      startTime: z.string().describe("Start time (ISO 8601)"),
      endTime: z.string().optional().describe("End time (ISO 8601)"),
      title: z.string().optional().describe("Appointment title"),
      appointmentStatus: z
        .enum(["new", "confirmed", "cancelled", "showed", "noshow", "invalid", "completed", "active"])
        .optional()
        .describe("Status"),
      assignedUserId: z.string().optional().describe("Assign to a team member user ID"),
      address: z.string().optional().describe("Address for the appointment"),
      description: z.string().optional().describe("Appointment description"),
      toNotify: z.boolean().optional().describe("Send notification to assignee (default true)"),
      ignoreDateRange: z.boolean().optional().describe("If true, ignore minimum scheduling notice and date range"),
      ignoreFreeSlotValidation: z.boolean().optional().describe("If true, skip time slot availability validation"),
      locationId: z.string().optional().describe("Target location"),
    },
    async (args) => {
      try {
        const client = await resolveClient(env, args.locationId);
        const result = await client.calendars.createAppointment(args);
        return ok(`Appointment created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_appointment",
    "Update an existing appointment (status, time, title, etc.).",
    {
      eventId: z.string().describe("Appointment ID to update"),
      startTime: z.string().optional().describe("New start time"),
      endTime: z.string().optional().describe("New end time"),
      title: z.string().optional().describe("New title"),
      appointmentStatus: z
        .enum(["confirmed", "new", "showed", "noshow", "cancelled", "invalid"])
        .optional()
        .describe("New status"),
      address: z.string().optional().describe("New address"),
      assignedUserId: z.string().optional().describe("Reassign to user"),
    },
    async ({ eventId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateAppointment(eventId, data);
        return ok(`Appointment updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_appointment",
    "Delete/cancel an appointment by ID.",
    { eventId: z.string().describe("Appointment ID to delete") },
    async ({ eventId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteAppointment(eventId);
        return ok(`Appointment ${eventId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== CALENDAR CRUD ==========

  server.tool(
    "ghl_create_calendar",
    "Create a new calendar (personal, round_robin, class_booking, collective, or service_booking).",
    {
      locationId: z.string().optional().describe("Target location"),
      name: z.string().describe("Calendar name"),
      calendarType: z.enum(["personal", "round_robin", "class_booking", "collective", "service_booking"]).optional().describe("Calendar type"),
      description: z.string().optional().describe("Calendar description"),
      slotDuration: z.number().optional().describe("Slot duration in minutes"),
      slotBuffer: z.number().optional().describe("Buffer between slots in minutes"),
      isActive: z.boolean().optional().describe("Whether the calendar is active"),
    },
    async ({ locationId, ...data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.createCalendar({ ...data, locationId: locationId || client.locationId });
        return ok(`Calendar created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_calendar",
    "Update an existing calendar's settings.",
    {
      calendarId: z.string().describe("Calendar ID to update"),
      name: z.string().optional().describe("Calendar name"),
      description: z.string().optional().describe("Calendar description"),
      slotDuration: z.number().optional().describe("Slot duration in minutes"),
      slotBuffer: z.number().optional().describe("Buffer between slots in minutes"),
      isActive: z.boolean().optional().describe("Whether the calendar is active"),
    },
    async ({ calendarId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateCalendar(calendarId, data);
        return ok(`Calendar updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_calendar",
    "Delete a calendar by ID.",
    { calendarId: z.string().describe("Calendar ID to delete") },
    async ({ calendarId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteCalendar(calendarId);
        return ok(`Calendar ${calendarId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== CALENDAR GROUPS ==========

  server.tool(
    "ghl_list_calendar_groups",
    "List all calendar groups in a location.",
    { locationId: z.string().optional().describe("Target location") },
    async ({ locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.listCalendarGroups(locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_calendar_group",
    "Get a specific calendar group by ID.",
    { groupId: z.string().describe("Calendar group ID") },
    async ({ groupId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getCalendarGroup(groupId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_calendar_group",
    "Create a new calendar group.",
    {
      locationId: z.string().optional().describe("Target location"),
      name: z.string().describe("Group name"),
      description: z.string().optional().describe("Group description"),
      slug: z.string().optional().describe("URL-friendly slug"),
    },
    async ({ locationId, ...data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.createCalendarGroup({ ...data, locationId: locationId || client.locationId });
        return ok(`Calendar group created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_calendar_group",
    "Update a calendar group.",
    {
      groupId: z.string().describe("Calendar group ID to update"),
      name: z.string().optional().describe("Group name"),
      description: z.string().optional().describe("Group description"),
      slug: z.string().optional().describe("URL-friendly slug"),
    },
    async ({ groupId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateCalendarGroup(groupId, data);
        return ok(`Calendar group updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_calendar_group",
    "Delete a calendar group.",
    { groupId: z.string().describe("Calendar group ID to delete") },
    async ({ groupId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteCalendarGroup(groupId);
        return ok(`Calendar group ${groupId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== BLOCKED SLOTS (continued) ==========

  server.tool(
    "ghl_update_blocked_slot",
    "Update an existing blocked time slot.",
    {
      slotId: z.string().describe("Blocked slot ID"),
      startTime: z.string().optional().describe("New start time (ISO 8601)"),
      endTime: z.string().optional().describe("New end time (ISO 8601)"),
      title: z.string().optional().describe("New reason/title"),
    },
    async ({ slotId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateBlockedSlot(slotId, data);
        return ok(`Blocked slot updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_list_blocked_slots",
    "List blocked time slots on a calendar in a date range. Dates auto-convert to epoch millis.",
    {
      calendarId: z.string().describe("Calendar ID"),
      startTime: z.string().describe("Start time (ISO 8601 or epoch millis)"),
      endTime: z.string().describe("End time (ISO 8601 or epoch millis)"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ calendarId, startTime, endTime, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const toMillis = (t: string) => {
          if (/^\d+$/.test(t)) return t;
          return String(new Date(t).getTime());
        };
        const result = await client.calendars.listBlockedSlots(
          calendarId,
          toMillis(startTime),
          toMillis(endTime),
          locationId
        );
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_blocked_slot",
    "Block a time slot on a calendar.",
    {
      calendarId: z.string().describe("Calendar ID"),
      startTime: z.string().describe("Block start (ISO 8601)"),
      endTime: z.string().describe("Block end (ISO 8601)"),
      title: z.string().optional().describe("Reason/title for the block"),
      locationId: z.string().optional().describe("Target location"),
    },
    async (args) => {
      try {
        const client = await resolveClient(env, args.locationId);
        const result = await client.calendars.createBlockedSlot(args);
        return ok(`Blocked slot created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_blocked_slot",
    "Remove a blocked slot from a calendar.",
    { slotId: z.string().describe("Blocked slot ID") },
    async ({ slotId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteBlockedSlot(slotId);
        return ok(`Blocked slot ${slotId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== VALIDATE GROUP SLUG ==========

  server.tool(
    "ghl_validate_group_slug",
    "Validate a calendar group URL slug to check availability.",
    {
      locationId: z.string().optional().describe("Target location"),
      slug: z.string().describe("Slug to validate"),
    },
    async ({ locationId, slug }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.validateGroupSlug({ locationId: locationId || client.locationId, slug });
        return ok(`Slug validation result:\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== APPOINTMENT NOTES ==========

  server.tool(
    "ghl_get_appointment_notes",
    "Get all notes for a specific appointment.",
    { appointmentId: z.string().describe("Appointment ID") },
    async ({ appointmentId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getAppointmentNotes(appointmentId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_appointment_note",
    "Add a note to an appointment.",
    {
      appointmentId: z.string().describe("Appointment ID"),
      body: z.string().optional().describe("Note body/content"),
      notes: z.string().optional().describe("Note text"),
    },
    async ({ appointmentId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.createAppointmentNote(appointmentId, data);
        return ok(`Appointment note created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_appointment_note",
    "Update a note on an appointment.",
    {
      appointmentId: z.string().describe("Appointment ID"),
      noteId: z.string().describe("Note ID"),
      body: z.string().optional().describe("Updated note body/content"),
      notes: z.string().optional().describe("Updated note text"),
    },
    async ({ appointmentId, noteId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateAppointmentNote(appointmentId, noteId, data);
        return ok(`Appointment note updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_appointment_note",
    "Delete a note from an appointment.",
    {
      appointmentId: z.string().describe("Appointment ID"),
      noteId: z.string().describe("Note ID"),
    },
    async ({ appointmentId, noteId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteAppointmentNote(appointmentId, noteId);
        return ok(`Appointment note ${noteId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== CALENDAR RESOURCES ==========

  server.tool(
    "ghl_list_calendar_resources",
    "List calendar resources by type (e.g. equipments, rooms).",
    {
      resourceType: z.string().describe("Resource type (e.g. equipments, rooms)"),
      locationId: z.string().optional().describe("Target location"),
    },
    async ({ resourceType, locationId }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.listCalendarResources(resourceType, locationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_calendar_resource",
    "Create a new calendar resource (equipment, room, etc.).",
    {
      resourceType: z.string().describe("Resource type (e.g. equipments, rooms)"),
      name: z.string().optional().describe("Resource name"),
      description: z.string().optional().describe("Resource description"),
      quantity: z.number().optional().describe("Available quantity"),
      locationId: z.string().optional().describe("Target location"),
      outOfService: z.boolean().optional().describe("Whether the resource is out of service"),
      calendarIds: z.array(z.string()).optional().describe("Associated calendar IDs"),
    },
    async ({ resourceType, locationId, ...data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.createCalendarResource(resourceType, { ...data, locationId: locationId || client.locationId });
        return ok(`Calendar resource created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_calendar_resource",
    "Get a specific calendar resource by type and ID.",
    {
      resourceType: z.string().describe("Resource type (e.g. equipments, rooms)"),
      id: z.string().describe("Resource ID"),
    },
    async ({ resourceType, id }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getCalendarResource(resourceType, id);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_calendar_resource",
    "Update a calendar resource.",
    {
      resourceType: z.string().describe("Resource type (e.g. equipments, rooms)"),
      id: z.string().describe("Resource ID"),
      name: z.string().optional().describe("Resource name"),
      description: z.string().optional().describe("Resource description"),
      quantity: z.number().optional().describe("Available quantity"),
      outOfService: z.boolean().optional().describe("Whether the resource is out of service"),
      calendarIds: z.array(z.string()).optional().describe("Associated calendar IDs"),
    },
    async ({ resourceType, id, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateCalendarResource(resourceType, id, data);
        return ok(`Calendar resource updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_calendar_resource",
    "Delete a calendar resource.",
    {
      resourceType: z.string().describe("Resource type (e.g. equipments, rooms)"),
      id: z.string().describe("Resource ID"),
    },
    async ({ resourceType, id }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteCalendarResource(resourceType, id);
        return ok(`Calendar resource ${id} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== CALENDAR NOTIFICATIONS ==========

  server.tool(
    "ghl_list_calendar_notifications",
    "List all notifications configured for a calendar.",
    { calendarId: z.string().describe("Calendar ID") },
    async ({ calendarId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.listCalendarNotifications(calendarId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_calendar_notification",
    "Create a notification for a calendar.",
    {
      calendarId: z.string().describe("Calendar ID"),
      type: z.string().optional().describe("Notification type"),
      shouldSendToContact: z.boolean().optional().describe("Send to contact"),
      shouldSendToUser: z.boolean().optional().describe("Send to assigned user"),
      shouldSendToGuest: z.boolean().optional().describe("Send to guest"),
      selectedUsers: z.array(z.string()).optional().describe("Specific user IDs to notify"),
      templateId: z.string().optional().describe("Template ID for the notification"),
    },
    async ({ calendarId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.createCalendarNotification(calendarId, data);
        return ok(`Calendar notification created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_calendar_notification",
    "Get a specific calendar notification by ID.",
    {
      calendarId: z.string().describe("Calendar ID"),
      notificationId: z.string().describe("Notification ID"),
    },
    async ({ calendarId, notificationId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getCalendarNotification(calendarId, notificationId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_calendar_notification",
    "Update a calendar notification.",
    {
      calendarId: z.string().describe("Calendar ID"),
      notificationId: z.string().describe("Notification ID"),
      type: z.string().optional().describe("Notification type"),
      shouldSendToContact: z.boolean().optional().describe("Send to contact"),
      shouldSendToUser: z.boolean().optional().describe("Send to assigned user"),
      shouldSendToGuest: z.boolean().optional().describe("Send to guest"),
      selectedUsers: z.array(z.string()).optional().describe("Specific user IDs to notify"),
      templateId: z.string().optional().describe("Template ID for the notification"),
    },
    async ({ calendarId, notificationId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateCalendarNotification(calendarId, notificationId, data);
        return ok(`Calendar notification updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_calendar_notification",
    "Delete a calendar notification.",
    {
      calendarId: z.string().describe("Calendar ID"),
      notificationId: z.string().describe("Notification ID"),
    },
    async ({ calendarId, notificationId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteCalendarNotification(calendarId, notificationId);
        return ok(`Calendar notification ${notificationId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== GROUP STATUS ==========

  server.tool(
    "ghl_update_calendar_group_status",
    "Update the status of a calendar group (enable/disable).",
    {
      groupId: z.string().describe("Calendar group ID"),
      isActive: z.boolean().optional().describe("Whether the group is active"),
    },
    async ({ groupId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateCalendarGroupStatus(groupId, data);
        return ok(`Calendar group status updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== AVAILABILITY SCHEDULES ==========

  server.tool(
    "ghl_list_availability_schedules",
    "List availability schedules for a user.",
    { userId: z.string().describe("User ID to list schedules for") },
    async ({ userId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.listAvailabilitySchedules(userId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_availability_schedule",
    "Get a specific availability schedule by ID.",
    { scheduleId: z.string().describe("Availability schedule ID") },
    async ({ scheduleId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getAvailabilitySchedule(scheduleId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_availability_schedule",
    "Create a new availability schedule.",
    {
      name: z.string().optional().describe("Schedule name"),
      locationId: z.string().optional().describe("Target location"),
      timezone: z.string().optional().describe("Timezone for the schedule"),
    },
    async (args) => {
      try {
        const client = await resolveClient(env, args.locationId);
        const result = await client.calendars.createAvailabilitySchedule(args);
        return ok(`Availability schedule created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_availability_schedule",
    "Update an existing availability schedule.",
    {
      scheduleId: z.string().describe("Availability schedule ID"),
      name: z.string().optional().describe("Schedule name"),
      timezone: z.string().optional().describe("Timezone for the schedule"),
    },
    async ({ scheduleId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateAvailabilitySchedule(scheduleId, data);
        return ok(`Availability schedule updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_availability_schedule",
    "Delete an availability schedule by ID.",
    { scheduleId: z.string().describe("Availability schedule ID to delete") },
    async ({ scheduleId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteAvailabilitySchedule(scheduleId);
        return ok(`Availability schedule ${scheduleId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_add_calendar_to_schedule",
    "Add a calendar to an availability schedule.",
    {
      scheduleId: z.string().describe("Availability schedule ID"),
      calendarId: z.string().optional().describe("Calendar ID to add"),
    },
    async ({ scheduleId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.addCalendarToSchedule(scheduleId, data);
        return ok(`Calendar added to schedule!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_remove_calendar_from_schedule",
    "Remove a calendar from an availability schedule.",
    {
      scheduleId: z.string().describe("Availability schedule ID"),
      calendarId: z.string().describe("Calendar ID to remove"),
    },
    async ({ scheduleId, calendarId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.removeCalendarFromSchedule(scheduleId, calendarId);
        return ok(`Calendar ${calendarId} removed from schedule ${scheduleId}.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_calendar_schedule",
    "Create availability hours/schedule for a specific calendar.",
    {
      calendarId: z.string().describe("Calendar ID"),
      openHours: z.array(z.any()).optional().describe("Open hours configuration array"),
    },
    async ({ calendarId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.createCalendarSchedule(calendarId, data);
        return ok(`Calendar schedule created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_calendar_schedule",
    "Get the availability schedule for a specific calendar.",
    { calendarId: z.string().describe("Calendar ID") },
    async ({ calendarId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getCalendarSchedule(calendarId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_calendar_schedule",
    "Update the availability schedule for a specific calendar.",
    {
      calendarId: z.string().describe("Calendar ID"),
      openHours: z.array(z.any()).optional().describe("Open hours configuration array"),
    },
    async ({ calendarId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateCalendarSchedule(calendarId, data);
        return ok(`Calendar schedule updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== SERVICE BOOKINGS ==========

  server.tool(
    "ghl_list_service_bookings",
    "List service bookings in a location.",
    {
      locationId: z.string().optional().describe("Target location"),
      contactId: z.string().optional().describe("Filter by contact ID"),
      startTime: z.string().optional().describe("Filter start time (ISO 8601)"),
      endTime: z.string().optional().describe("Filter end time (ISO 8601)"),
    },
    async ({ locationId, ...rest }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.listServiceBookings({ locationId, ...rest });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_service_booking",
    "Create a new service booking.",
    {
      locationId: z.string().optional().describe("Target location"),
      calendarId: z.string().optional().describe("Calendar ID for the service"),
      contactId: z.string().optional().describe("Contact ID"),
      startTime: z.string().optional().describe("Booking start time (ISO 8601)"),
      endTime: z.string().optional().describe("Booking end time (ISO 8601)"),
      serviceId: z.string().optional().describe("Service ID"),
    },
    async ({ locationId, ...data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.createServiceBooking({ locationId, ...data });
        return ok(`Service booking created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_service_booking",
    "Get a specific service booking by ID.",
    { bookingId: z.string().describe("Service booking ID") },
    async ({ bookingId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getServiceBooking(bookingId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_service_booking",
    "Update an existing service booking.",
    {
      bookingId: z.string().describe("Service booking ID"),
      startTime: z.string().optional().describe("New start time (ISO 8601)"),
      endTime: z.string().optional().describe("New end time (ISO 8601)"),
      status: z.string().optional().describe("Booking status"),
    },
    async ({ bookingId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateServiceBooking(bookingId, data);
        return ok(`Service booking updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_service_booking",
    "Delete a service booking by ID.",
    { bookingId: z.string().describe("Service booking ID to delete") },
    async ({ bookingId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteServiceBooking(bookingId);
        return ok(`Service booking ${bookingId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  // ========== SERVICES CATALOG ==========

  server.tool(
    "ghl_list_services",
    "List services in a location's service catalog.",
    {
      locationId: z.string().optional().describe("Target location"),
      calendarId: z.string().optional().describe("Filter by calendar ID"),
    },
    async ({ locationId, ...rest }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.listServices({ locationId, ...rest });
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_create_service",
    "Create a new service in the services catalog.",
    {
      locationId: z.string().optional().describe("Target location"),
      name: z.string().optional().describe("Service name"),
      description: z.string().optional().describe("Service description"),
      durationMinutes: z.number().optional().describe("Service duration in minutes"),
      price: z.number().optional().describe("Service price"),
      calendarIds: z.array(z.string()).optional().describe("Associated calendar IDs"),
    },
    async ({ locationId, ...data }) => {
      try {
        const client = await resolveClient(env, locationId);
        const result = await client.calendars.createService({ locationId, ...data });
        return ok(`Service created!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_get_service",
    "Get a specific service by ID.",
    { serviceId: z.string().describe("Service ID") },
    async ({ serviceId }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.getService(serviceId);
        return ok(JSON.stringify(result, null, 2));
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_update_service",
    "Update a service in the services catalog.",
    {
      serviceId: z.string().describe("Service ID"),
      name: z.string().optional().describe("Service name"),
      description: z.string().optional().describe("Service description"),
      durationMinutes: z.number().optional().describe("Service duration in minutes"),
      price: z.number().optional().describe("Service price"),
      calendarIds: z.array(z.string()).optional().describe("Associated calendar IDs"),
    },
    async ({ serviceId, ...data }) => {
      try {
        const client = await resolveClient(env);
        const result = await client.calendars.updateService(serviceId, data);
        return ok(`Service updated!\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e: any) {
        return err(e);
      }
    }
  );

  server.tool(
    "ghl_delete_service",
    "Delete a service from the services catalog.",
    { serviceId: z.string().describe("Service ID to delete") },
    async ({ serviceId }) => {
      try {
        const client = await resolveClient(env);
        await client.calendars.deleteService(serviceId);
        return ok(`Service ${serviceId} deleted.`);
      } catch (e: any) {
        return err(e);
      }
    }
  );
}
