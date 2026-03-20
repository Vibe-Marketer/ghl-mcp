import { BaseGHLClient } from "./base";

export function calendarMethods(client: BaseGHLClient) {
  return {
    async listCalendars(locationId?: string) {
      return client.request<{ calendars: any[] }>("GET", `/calendars/`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async getCalendar(calendarId: string) {
      return client.request<{ calendar: any }>("GET", `/calendars/${calendarId}`, {
        version: "2021-07-28",
      });
    },

    async createCalendar(data: any) {
      return client.request<{ calendar: any }>("POST", `/calendars/`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async updateCalendar(calendarId: string, data: any) {
      return client.request<{ calendar: any }>("PUT", `/calendars/${calendarId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteCalendar(calendarId: string) {
      return client.request<any>("DELETE", `/calendars/${calendarId}`, {
        version: "2021-07-28",
      });
    },

    async getCalendarFreeSlots(calendarId: string, startDate: string, endDate: string, timezone?: string) {
      const query: Record<string, string> = { startDate, endDate };
      if (timezone) query.timezone = timezone;
      return client.request<any>("GET", `/calendars/${calendarId}/free-slots`, {
        query,
        version: "2021-07-28",
      });
    },

    async listCalendarEvents(calendarId: string, startTime: string, endTime: string, locationId?: string) {
      return client.request<{ events: any[] }>("GET", `/calendars/events`, {
        query: { calendarId, startTime, endTime, locationId: locationId || client.locationId },
        version: "2021-04-15",
      });
    },

    async getAppointment(eventId: string) {
      return client.request<any>("GET", `/calendars/events/appointments/${eventId}`, {
        version: "2021-04-15",
      });
    },

    async createAppointment(data: any) {
      return client.request<any>("POST", `/calendars/events/appointments`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-04-15",
      });
    },

    async updateAppointment(eventId: string, data: any) {
      return client.request<any>("PUT", `/calendars/events/appointments/${eventId}`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async deleteAppointment(eventId: string) {
      return client.request<any>("DELETE", `/calendars/events/appointments/${eventId}`, {
        version: "2021-04-15",
      });
    },

    async listBlockedSlots(calendarId: string, startTime: string, endTime: string, locationId?: string) {
      return client.request<any>("GET", `/calendars/blocked-slots`, {
        query: { calendarId, startTime, endTime, locationId: locationId || client.locationId },
        version: "2021-04-15",
      });
    },

    async createBlockedSlot(data: any) {
      return client.request<any>("POST", `/calendars/blocked-slots`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-04-15",
      });
    },

    async updateBlockedSlot(slotId: string, data: any) {
      return client.request<any>("PUT", `/calendars/blocked-slots/${slotId}`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async deleteBlockedSlot(slotId: string) {
      return client.request<any>("DELETE", `/calendars/blocked-slots/${slotId}`, {
        version: "2021-04-15",
      });
    },

    async listCalendarGroups(locationId?: string) {
      return client.request<any>("GET", `/calendars/groups`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-04-15",
      });
    },

    async getCalendarGroup(groupId: string) {
      return client.request<any>("GET", `/calendars/groups/${groupId}`, {
        version: "2021-04-15",
      });
    },

    async createCalendarGroup(data: any) {
      return client.request<any>("POST", `/calendars/groups`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async updateCalendarGroup(groupId: string, data: any) {
      return client.request<any>("PUT", `/calendars/groups/${groupId}`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async deleteCalendarGroup(groupId: string) {
      return client.request<any>("DELETE", `/calendars/groups/${groupId}`, {
        version: "2021-04-15",
      });
    },

    async validateGroupSlug(data: any) {
      return client.request<any>("POST", `/calendars/groups/validate-slug`, {
        body: data,
        version: "2021-04-15",
      });
    },

    // ========== APPOINTMENT NOTES ==========

    async getAppointmentNotes(appointmentId: string) {
      return client.request<any>("GET", `/calendars/events/appointments/${appointmentId}/notes`, {
        version: "2021-04-15",
      });
    },

    async createAppointmentNote(appointmentId: string, data: any) {
      return client.request<any>("POST", `/calendars/events/appointments/${appointmentId}/notes`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async updateAppointmentNote(appointmentId: string, noteId: string, data: any) {
      return client.request<any>("PUT", `/calendars/events/appointments/${appointmentId}/notes/${noteId}`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async deleteAppointmentNote(appointmentId: string, noteId: string) {
      return client.request<any>("DELETE", `/calendars/events/appointments/${appointmentId}/notes/${noteId}`, {
        version: "2021-04-15",
      });
    },

    // ========== CALENDAR RESOURCES ==========

    async listCalendarResources(resourceType: string, locationId?: string) {
      return client.request<any>("GET", `/calendars/resources/${resourceType}`, {
        query: { locationId: locationId || client.locationId },
        version: "2021-04-15",
      });
    },

    async createCalendarResource(resourceType: string, data: any) {
      return client.request<any>("POST", `/calendars/resources/${resourceType}`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async getCalendarResource(resourceType: string, id: string) {
      return client.request<any>("GET", `/calendars/resources/${resourceType}/${id}`, {
        version: "2021-04-15",
      });
    },

    async updateCalendarResource(resourceType: string, id: string, data: any) {
      return client.request<any>("PUT", `/calendars/resources/${resourceType}/${id}`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async deleteCalendarResource(resourceType: string, id: string) {
      return client.request<any>("DELETE", `/calendars/resources/${resourceType}/${id}`, {
        version: "2021-04-15",
      });
    },

    // ========== CALENDAR NOTIFICATIONS ==========

    async listCalendarNotifications(calendarId: string) {
      return client.request<any>("GET", `/calendars/${calendarId}/notifications`, {
        version: "2021-04-15",
      });
    },

    async createCalendarNotification(calendarId: string, data: any) {
      return client.request<any>("POST", `/calendars/${calendarId}/notifications`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async getCalendarNotification(calendarId: string, notificationId: string) {
      return client.request<any>("GET", `/calendars/${calendarId}/notifications/${notificationId}`, {
        version: "2021-04-15",
      });
    },

    async updateCalendarNotification(calendarId: string, notificationId: string, data: any) {
      return client.request<any>("PUT", `/calendars/${calendarId}/notifications/${notificationId}`, {
        body: data,
        version: "2021-04-15",
      });
    },

    async deleteCalendarNotification(calendarId: string, notificationId: string) {
      return client.request<any>("DELETE", `/calendars/${calendarId}/notifications/${notificationId}`, {
        version: "2021-04-15",
      });
    },

    // ========== GROUP STATUS ==========

    async updateCalendarGroupStatus(groupId: string, data: any) {
      return client.request<any>("PUT", `/calendars/groups/${groupId}/status`, {
        body: data,
        version: "2021-04-15",
      });
    },

    // ========== AVAILABILITY SCHEDULES ==========

    async listAvailabilitySchedules(userId: string) {
      return client.request<any>("GET", `/calendars/availability/schedules`, {
        query: { userId },
        version: "2021-07-28",
      });
    },

    async getAvailabilitySchedule(scheduleId: string) {
      return client.request<any>("GET", `/calendars/availability/schedules/${scheduleId}`, {
        version: "2021-07-28",
      });
    },

    async createAvailabilitySchedule(data: any) {
      return client.request<any>("POST", `/calendars/availability/schedules`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async updateAvailabilitySchedule(scheduleId: string, data: any) {
      return client.request<any>("PUT", `/calendars/availability/schedules/${scheduleId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteAvailabilitySchedule(scheduleId: string) {
      return client.request<any>("DELETE", `/calendars/availability/schedules/${scheduleId}`, {
        version: "2021-07-28",
      });
    },

    async addCalendarToSchedule(scheduleId: string, data: any) {
      return client.request<any>("POST", `/calendars/availability/schedules/${scheduleId}/calendars`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async removeCalendarFromSchedule(scheduleId: string, calendarId: string) {
      return client.request<any>("DELETE", `/calendars/availability/schedules/${scheduleId}/calendars/${calendarId}`, {
        version: "2021-07-28",
      });
    },

    async createCalendarSchedule(calendarId: string, data: any) {
      return client.request<any>("POST", `/calendars/${calendarId}/availability`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async getCalendarSchedule(calendarId: string) {
      return client.request<any>("GET", `/calendars/${calendarId}/availability`, {
        version: "2021-07-28",
      });
    },

    async updateCalendarSchedule(calendarId: string, data: any) {
      return client.request<any>("PUT", `/calendars/${calendarId}/availability`, {
        body: data,
        version: "2021-07-28",
      });
    },

    // ========== SERVICE BOOKINGS ==========

    async listServiceBookings(params: any = {}) {
      return client.request<any>("GET", `/calendars/service-bookings`, {
        query: { locationId: params.locationId || client.locationId, ...params },
        version: "2021-07-28",
      });
    },

    async createServiceBooking(data: any) {
      return client.request<any>("POST", `/calendars/service-bookings`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async getServiceBooking(bookingId: string) {
      return client.request<any>("GET", `/calendars/service-bookings/${bookingId}`, {
        version: "2021-07-28",
      });
    },

    async updateServiceBooking(bookingId: string, data: any) {
      return client.request<any>("PUT", `/calendars/service-bookings/${bookingId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteServiceBooking(bookingId: string) {
      return client.request<any>("DELETE", `/calendars/service-bookings/${bookingId}`, {
        version: "2021-07-28",
      });
    },

    // ========== SERVICES CATALOG ==========

    async listServices(params: any = {}) {
      return client.request<any>("GET", `/calendars/services`, {
        query: { locationId: params.locationId || client.locationId, ...params },
        version: "2021-07-28",
      });
    },

    async createService(data: any) {
      return client.request<any>("POST", `/calendars/services`, {
        body: { ...data, locationId: data.locationId || client.locationId },
        version: "2021-07-28",
      });
    },

    async getService(serviceId: string) {
      return client.request<any>("GET", `/calendars/services/${serviceId}`, {
        version: "2021-07-28",
      });
    },

    async updateService(serviceId: string, data: any) {
      return client.request<any>("PUT", `/calendars/services/${serviceId}`, {
        body: data,
        version: "2021-07-28",
      });
    },

    async deleteService(serviceId: string) {
      return client.request<any>("DELETE", `/calendars/services/${serviceId}`, {
        version: "2021-07-28",
      });
    },
  };
}
