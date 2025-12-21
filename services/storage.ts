import { CalendarEvent, Notification, ReminderSettings } from '../types';

const STORAGE_KEY_EVENTS = 'lifestream_events';
const STORAGE_KEY_NOTIFICATIONS = 'lifestream_notifications';
const STORAGE_KEY_REMINDER_SETTINGS = 'lifestream_reminder_settings';

// Check if we're in the browser environment
const isBrowser = typeof window !== 'undefined';

export const saveEvents = (events: CalendarEvent[]) => {
  try {
    if (isBrowser) {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    }
  } catch (e) {
    console.error("Failed to save events", e);
  }
};

export const loadEvents = (): CalendarEvent[] => {
  try {
    if (isBrowser) {
      const data = localStorage.getItem(STORAGE_KEY_EVENTS);
      return data ? JSON.parse(data) : [];
    }
    return [];
  } catch (e) {
    console.error("Failed to load events", e);
    return [];
  }
};

export const saveNotifications = (notifications: Notification[]) => {
  try {
    if (isBrowser) {
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
    }
  } catch (e) {
    console.error("Failed to save notifications", e);
  }
};

export const loadNotifications = (): Notification[] => {
  try {
    if (isBrowser) {
      const data = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      return data ? JSON.parse(data) : [];
    }
    return [];
  } catch (e) {
    console.error("Failed to load notifications", e);
    return [];
  }
};

export const saveReminderSettings = (settings: ReminderSettings) => {
  try {
    if (isBrowser) {
      localStorage.setItem(STORAGE_KEY_REMINDER_SETTINGS, JSON.stringify(settings));
    }
  } catch (e) {
    console.error("Failed to save reminder settings", e);
  }
};

export const loadReminderSettings = (): ReminderSettings => {
  try {
    if (isBrowser) {
      const data = localStorage.getItem(STORAGE_KEY_REMINDER_SETTINGS);
      if (data) {
        return JSON.parse(data);
      }
    }
    // Default settings
    return {
      desktopNotifications: true,
      appNotifications: true,
      emailNotifications: false,
      defaultReminderMinutes: 15,
      reminderSound: true
    };
  } catch (e) {
    console.error("Failed to load reminder settings", e);
    // Return default settings on error
    return {
      desktopNotifications: true,
      appNotifications: true,
      emailNotifications: false,
      defaultReminderMinutes: 15,
      reminderSound: true
    };
  }
};
