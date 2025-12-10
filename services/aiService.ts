import { CalendarEvent } from "../types";

export const processUserRequest = async (
  transcript: string,
  currentEvents: CalendarEvent[],
  viewDate: Date // Renamed from currentDate to avoid confusion, this is the calendar view cursor
): Promise<{ events: Omit<CalendarEvent, 'id' | 'isCompleted' | 'reminderEnabled' | 'reminderMinutes' | 'notified'>[], message: string }> => {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        currentEvents,
        viewDate: viewDate.toISOString()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch AI response');
    }

    return await response.json();
  } catch (error) {
    console.error("Error processing request:", error);
    throw error;
  }
};