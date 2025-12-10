import { CalendarEvent } from '../types';

const STORAGE_KEY = 'lifestream_events';

// Check if we're in the browser environment
const isBrowser = typeof window !== 'undefined';

export const saveEvents = (events: CalendarEvent[]) => {
  try {
    if (isBrowser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }
  } catch (e) {
    console.error("Failed to save events", e);
  }
};

export const loadEvents = (): CalendarEvent[] => {
  try {
    if (isBrowser) {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    }
    return [];
  } catch (e) {
    console.error("Failed to load events", e);
    return [];
  }
};
