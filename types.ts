export enum EventType {
  WORK = 'WORK',
  PERSONAL = 'PERSONAL',
  URGENT = 'URGENT',
  OTHER = 'OTHER'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO String
  end: string; // ISO String
  type: EventType;
  priority: Priority;
  isCompleted: boolean;
  reminderEnabled: boolean;
  reminderMinutes: number;
  notified?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'reminder' | 'system';
  relatedEventId?: string;
  isRead: boolean;
  timestamp: string;
}

export interface AiResponseSchema {
  eventsToAdd: {
    title: string;
    start: string;
    end: string;
    description: string;
    type: string;
    priority: string;
  }[];
  confirmationMessage: string;
}

export interface ReminderSettings {
  desktopNotifications: boolean;
  appNotifications: boolean;
  emailNotifications: boolean;
  defaultReminderMinutes: number;
  reminderSound: boolean;
}