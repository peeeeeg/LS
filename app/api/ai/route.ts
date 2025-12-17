import { NextResponse } from 'next/server';
import { CalendarEvent, EventType, Priority } from "@/types";

const parseEventType = (typeStr: string): EventType => {
  const normalized = typeStr.toUpperCase();
  if (normalized in EventType) {
    return normalized as EventType;
  }
  return EventType.OTHER;
};

const parsePriority = (prioStr: string): Priority => {
  const normalized = prioStr?.toUpperCase();
  if (normalized in Priority) {
    return normalized as Priority;
  }
  return Priority.MEDIUM;
};

export async function POST(request: Request) {
  try {
    const { transcript, currentEvents, viewDate } = await request.json();
    
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("API Key missing");
    }

    // Get real-time context for "today/tomorrow" calculations
    const now = new Date();
    const userTimezone = 'Asia/Shanghai'; // 强制使用上海时区
    // Format: "2023/10/27 14:30:00"
    const userLocalTime = now.toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai', 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric', 
      second: 'numeric',
      hour12: false 
    });
    
    // Format the view date (the month the user is looking at) just in case context is needed
    const viewDateObj = new Date(viewDate);
    const viewDateStr = viewDateObj.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long',
      timeZone: 'Asia/Shanghai'
    });

    const prompt = `
      You are an intelligent calendar assistant.
      
      CRITICAL CONTEXT:
      - User's Timezone: ${userTimezone}
      - Current User Local Time (Right Now): ${userLocalTime}
      - User is currently viewing the calendar for: ${viewDateStr}
      
      Your goal is to parse the user's natural language request and extract calendar events.
      
      Rules for Time Calculation:
      1. Base all relative dates (like "tomorrow", "this afternoon") on the "Current User Local Time" provided above.
      2. When the user specifies a time (e.g., "at 2 PM"), it refers to ${userTimezone} time.
      3. IMPORTANT: The output 'start' and 'end' must be ISO 8601 strings. You MUST calculate the correct ISO string such that when parsed back in the ${userTimezone}, it matches the user's requested time. 
         - Example: If user is in UTC+8 and says "3 PM", the ISO string should end in Z and be equivalent to 07:00 UTC, OR include the offset (e.g. T15:00:00+08:00).
      4. If no duration is specified, assume 1 hour.
      
      Categorization Rules:
      1. Categorize events into WORK, PERSONAL, URGENT, or OTHER.
      2. Determine Priority: HIGH (crucial/urgent), MEDIUM (standard), or LOW (optional/flexible). Default to MEDIUM.
      
      Language Rules:
      1. Detect the language of the user's input. 
      2. The 'confirmationMessage' MUST be in the same language as the user's input.
      
      Return an empty array for 'eventsToAdd' if the user is just chatting.

      User request: ${transcript}

      Please output only valid JSON in the following format:
      {"eventsToAdd": [{"title": "Event Title", "start": "2023-10-27T14:30:00+08:00", "end": "2023-10-27T15:30:00+08:00", "description": "Event Description", "type": "WORK", "priority": "MEDIUM"}], "confirmationMessage": "Confirmation message in user's language"}
    `;

    // Call DeepSeek API
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!deepseekResponse.ok) {
      const errorData = await deepseekResponse.json().catch(() => ({}));
      throw new Error(`DeepSeek API error: ${errorData.error?.message || deepseekResponse.statusText}`);
    }

    const result = await deepseekResponse.json();
    
    // Extract text from the response
    if (!result.choices || result.choices.length === 0) {
      throw new Error("No choices found in the response");
    }
    
    const choice = result.choices[0];
    if (!choice.message || !choice.message.content) {
      throw new Error("No content found in the response");
    }
    
    const text = choice.message.content;
    if (!text) {
      throw new Error("No text found in the response");
    }
    
    // Extract JSON from the response (in case it's wrapped in text)
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("Invalid JSON response from AI");
    }
    
    const jsonStr = text.substring(jsonStart, jsonEnd);
    const parsedJson = JSON.parse(jsonStr);
    
    // Process the AI response
    const events = parsedJson.eventsToAdd.map((e: any) => ({
      title: e.title,
      start: e.start,
      end: e.end,
      description: e.description || "",
      type: parseEventType(e.type),
      priority: parsePriority(e.priority)
    }));

    return NextResponse.json({
      events,
      message: parsedJson.confirmationMessage
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
