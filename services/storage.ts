import { CalendarEvent } from '../types';
import type { Notification, ReminderSettings } from '../types';

const STORAGE_KEYS = {
  EVENTS: 'lifestream_events',
  NOTIFICATIONS: 'lifestream_notifications',
  REMINDER_SETTINGS: 'lifestream_reminder_settings'
};

// Check if we're in the browser environment
const isBrowser = typeof window !== 'undefined';

export const saveEvents = (events: CalendarEvent[]) => {
  try {
    if (isBrowser) {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    }
  } catch (e) {
    console.error("Failed to save events", e);
  }
};

export const loadEvents = (): CalendarEvent[] => {
  try {
    if (isBrowser) {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
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
      const serialized = notifications.map(notification => ({
        ...notification,
        timestamp: notification.timestamp.toISOString()
      }));
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(serialized));
    }
  } catch (e) {
    console.error("Failed to save notifications", e);
  }
};

export const loadNotifications = (): Notification[] => {
  try {
    if (isBrowser) {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.map((notification: any) => ({
          ...notification,
          timestamp: new Date(notification.timestamp)
        }));
      }
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
      localStorage.setItem(STORAGE_KEYS.REMINDER_SETTINGS, JSON.stringify(settings));
    }
  } catch (e) {
    console.error("Failed to save reminder settings", e);
  }
};

export const loadReminderSettings = (): ReminderSettings => {
  try {
    if (isBrowser) {
      const data = localStorage.getItem(STORAGE_KEYS.REMINDER_SETTINGS);
      if (data) {
        return JSON.parse(data);
      }
    }
    // Return default settings if none exist
    return {
      desktopNotifications: true,
      soundNotifications: true,
      defaultReminderMinutes: 15,
      reminderSound: 'default',
      showReminderHistory: true,
      maxHistoryItems: 50
    };
  } catch (e) {
    console.error("Failed to load reminder settings", e);
    // Return default settings if there's an error
    return {
      desktopNotifications: true,
      soundNotifications: true,
      defaultReminderMinutes: 15,
      reminderSound: 'default',
      showReminderHistory: true,
      maxHistoryItems: 50
    };
  }
};

export const clearOldNotifications = (notifications: Notification[], maxItems: number): Notification[] => {
  // Sort by timestamp descending (newest first)
  const sorted = [...notifications].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  // Keep only the newest items
  return sorted.slice(0, maxItems);
};
