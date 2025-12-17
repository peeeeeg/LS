'use client';

import React, { useState, useEffect } from 'react';
import { CalendarGrid } from './CalendarGrid';
import { Assistant } from './Assistant';
import { CalendarEvent, ChatMessage, CalendarViewMode, Priority } from '../types';
import { loadEvents, saveEvents } from '../services/storage';
import { processUserRequest } from '../services/aiService';
import { X, Bell, Clock, ChevronsUp, Minus, ChevronsDown, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showMobileAssistant, setShowMobileAssistant] = useState(false);

  // Initialize
  useEffect(() => {
    const loaded = loadEvents();
    // Backward compatibility for old events
    const migratedEvents = loaded.map(e => ({
      ...e,
      reminderEnabled: e.reminderEnabled !== undefined ? e.reminderEnabled : true,
      reminderMinutes: e.reminderMinutes !== undefined ? e.reminderMinutes : 15,
      priority: e.priority !== undefined ? e.priority : Priority.MEDIUM
    }));
    setEvents(migratedEvents);

    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // Persistence
  useEffect(() => {
    saveEvents(events);
  }, [events]);

  // Reminder System
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      setEvents(prev => prev.map(event => {
        if (!event.reminderEnabled || event.notified) return event;

        const eventStart = new Date(event.start).getTime();
        const reminderMs = event.reminderMinutes * 60 * 1000;
        const timeToStart = eventStart - now.getTime();
        
        if (timeToStart > 0 && timeToStart <= reminderMs) {
          if (Notification.permission === 'granted') {
            new Notification(`日程提醒: ${event.title}`, {
              body: `将在 ${Math.round(timeToStart / 60000)} 分钟后开始。`,
              icon: '/favicon.ico'
            });
          }
          return { ...event, notified: true };
        }
        return event;
      }));
    };

    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const { events: newEventsData, message } = await processUserRequest(text, events, currentDate);

      const createdEvents: CalendarEvent[] = newEventsData.map(e => ({
        ...e,
        id: crypto.randomUUID(),
        isCompleted: false,
        notified: false,
        reminderEnabled: true,
        reminderMinutes: 15
      }));

      if (createdEvents.length > 0) {
        setEvents(prev => [...prev, ...createdEvents]);
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "处理请求时出错，请检查网络或 API 配置。",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelectedEvent(null);
  };

  const handleToggleComplete = (id: string) => {
    setEvents(prev => prev.map(e => 
      e.id === id ? { ...e, isCompleted: !e.isCompleted } : e
    ));
    if (selectedEvent && selectedEvent.id === id) {
      setSelectedEvent(prev => prev ? { ...prev, isCompleted: !prev.isCompleted } : null);
    }
  };

  const handleToggleReminder = (id: string) => {
    setEvents(prev => prev.map(e => 
      e.id === id ? { ...e, reminderEnabled: !e.reminderEnabled } : e
    ));
    if (selectedEvent && selectedEvent.id === id) {
      setSelectedEvent(prev => prev ? { ...prev, reminderEnabled: !prev.reminderEnabled } : null);
    }
  };

  const handleUpdateReminderTime = (id: string, minutes: number) => {
     setEvents(prev => prev.map(e => 
      e.id === id ? { ...e, reminderMinutes: minutes, reminderEnabled: true, notified: false } : e
    ));
    if (selectedEvent && selectedEvent.id === id) {
      setSelectedEvent(prev => prev ? { ...prev, reminderMinutes: minutes, reminderEnabled: true, notified: false } : null);
    }
  };

  const REMINDER_OPTIONS = [
    { value: 0, label: '事件开始时' },
    { value: 5, label: '提前 5 分钟' },
    { value: 15, label: '提前 15 分钟' },
    { value: 30, label: '提前 30 分钟' },
    { value: 60, label: '提前 1 小时' },
    { value: 120, label: '提前 2 小时' },
    { value: 1440, label: '提前 1 天' },
  ];

  return (
    <div className="relative h-screen w-full bg-gray-100 flex overflow-hidden">
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-0">
        <header className="px-4 py-3 md:p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm flex-none z-10">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-lg">LS</span>
              LifeStream
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-2 md:p-4">
          <CalendarGrid 
            currentDate={currentDate} 
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            events={events}
            onMonthChange={setCurrentDate}
            onEventClick={setSelectedEvent}
            onToggleComplete={handleToggleComplete}
            onToggleReminder={handleToggleReminder}
          />
        </div>

        {/* Mobile Floating Action Button */}
        <button
          onClick={() => setShowMobileAssistant(true)}
          className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-transform active:scale-95 z-30"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-7 h-7" />
        </button>
      </div>

      {/* Assistant Sidebar / Mobile Drawer */}
      <div className={`
        fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:static md:bg-transparent md:backdrop-blur-none md:z-auto md:w-96 md:flex-none
        transition-all duration-300
        ${showMobileAssistant ? 'opacity-100 visible' : 'opacity-0 invisible md:opacity-100 md:visible'}
      `}
      onClick={() => setShowMobileAssistant(false)}
      >
        <div 
          className={`
            absolute bottom-0 left-0 right-0 h-[80vh] md:h-full md:relative bg-white shadow-2xl rounded-t-2xl md:rounded-none flex flex-col
            transform transition-transform duration-300 ease-out
            ${showMobileAssistant ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
          `}
          onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
        >
          <Assistant 
            isProcessing={isProcessing} 
            onSendMessage={handleSendMessage}
            messages={messages}
            onClose={() => setShowMobileAssistant(false)}
          />
        </div>
      </div>
      
      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex items-start gap-3 mb-2 pr-8">
               <button 
                 onClick={() => handleToggleComplete(selectedEvent.id)}
                 className={`p-1 mt-1 rounded-full transition-colors flex-shrink-0 ${selectedEvent.isCompleted ? 'text-indigo-600 bg-indigo-50' : 'text-gray-300 hover:text-gray-500'}`}
               >
                 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedEvent.isCompleted ? 'border-indigo-600' : 'border-current'}`}>
                   {selectedEvent.isCompleted && <div className="w-3 h-3 bg-indigo-600 rounded-full" />}
                 </div>
               </button>
               <div>
                 <h2 className={`text-xl font-bold leading-tight ${selectedEvent.isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                   {selectedEvent.title}
                 </h2>
                  <div className="flex gap-2 mt-2 flex-wrap">
                     <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-medium">
                      {selectedEvent.type}
                     </span>
                     <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                       selectedEvent.priority === Priority.HIGH ? 'bg-red-100 text-red-700' :
                       selectedEvent.priority === Priority.LOW ? 'bg-blue-50 text-blue-600' :
                       'bg-gray-100 text-gray-600'
                     }`}>
                       {selectedEvent.priority === Priority.HIGH && <ChevronsUp className="w-3 h-3" />}
                       {selectedEvent.priority === Priority.LOW && <ChevronsDown className="w-3 h-3" />}
                       {selectedEvent.priority === Priority.MEDIUM && <Minus className="w-3 h-3" />}
                       {selectedEvent.priority === Priority.HIGH ? '高' : selectedEvent.priority === Priority.LOW ? '低' : '中'}
                     </span>
                  </div>
               </div>
            </div>
            
            <div className="space-y-4 mt-6">
              <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-lg">
                 <div className="flex items-center gap-2 text-xs text-gray-500 uppercase font-semibold">
                    <Clock className="w-3 h-3" />
                    <span>时间</span>
                 </div>
                 <div className="text-gray-800 text-sm">
                   {new Date(selectedEvent.start).toLocaleString('zh-CN', { 
                     month: 'short', 
                     day: 'numeric', 
                     hour: '2-digit', 
                     minute: '2-digit', 
                     hour12: false,
                     timeZone: 'Asia/Shanghai'
                   })} 
                   <span className="mx-2 text-gray-400">至</span>
                   {new Date(selectedEvent.end).toLocaleTimeString('zh-CN', { 
                     hour: '2-digit', 
                     minute:'2-digit', 
                     hour12: false,
                     timeZone: 'Asia/Shanghai'
                   })}
                 </div>
              </div>
              
               <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className={`w-4 h-4 ${selectedEvent.reminderEnabled ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-700">提醒</span>
                    </div>
                    <button
                      onClick={() => handleToggleReminder(selectedEvent.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${selectedEvent.reminderEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedEvent.reminderEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                 </div>
                 
                 {selectedEvent.reminderEnabled && (
                   <div className="mt-2 pl-6">
                     <select
                       value={selectedEvent.reminderMinutes}
                       onChange={(e) => handleUpdateReminderTime(selectedEvent.id, Number(e.target.value))}
                       className="w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                     >
                       {REMINDER_OPTIONS.map(opt => (
                         <option key={opt.value} value={opt.value}>{opt.label}</option>
                       ))}
                     </select>
                   </div>
                 )}
              </div>

              {selectedEvent.description && (
                 <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 uppercase font-semibold">详情</span>
                  <p className="text-gray-700 text-sm leading-relaxed bg-white border border-gray-100 p-3 rounded-lg max-h-32 overflow-y-auto">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
              
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-2">
                <button 
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  删除
                </button>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors text-sm font-medium"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;