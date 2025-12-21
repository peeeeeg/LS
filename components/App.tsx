'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarGrid } from './CalendarGrid';
import { Assistant } from './Assistant';
import { CalendarEvent, ChatMessage, CalendarViewMode, Priority } from '../types';
import type { Notification, ReminderSettings } from '../types';
import { loadEvents, saveEvents, loadNotifications, saveNotifications, loadReminderSettings, saveReminderSettings, clearOldNotifications } from '../services/storage';
import { processUserRequest } from '../services/aiService';
import { X, Bell, Clock, ChevronsUp, Minus, ChevronsDown, Sparkles, Settings, CheckCircle, AlertTriangle, Info, Trash2, Filter, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showMobileAssistant, setShowMobileAssistant] = useState(false);
  
  // Reminder System State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    desktopNotifications: true,
    soundNotifications: true,
    defaultReminderMinutes: 15,
    reminderSound: 'default',
    showReminderHistory: true,
    maxHistoryItems: 50
  });
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const notificationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize notification sound
  useEffect(() => {
    notificationSoundRef.current = new Audio('/notification.mp3');
    return () => {
      if (notificationSoundRef.current) {
        notificationSoundRef.current.pause();
        notificationSoundRef.current = null;
      }
    };
  }, []);

  // 确保组件挂载时显示当前日期
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Initialize
  useEffect(() => {
    // Load events
    const loadedEvents = loadEvents();
    // Backward compatibility for old events
    const migratedEvents = loadedEvents.map(e => ({
      ...e,
      reminderEnabled: e.reminderEnabled !== undefined ? e.reminderEnabled : true,
      reminderMinutes: e.reminderMinutes !== undefined ? e.reminderMinutes : reminderSettings.defaultReminderMinutes,
      priority: e.priority !== undefined ? e.priority : Priority.MEDIUM
    }));
    setEvents(migratedEvents);
    
    // Load notifications
    const loadedNotifications = loadNotifications();
    setNotifications(loadedNotifications);
    
    // Load reminder settings
    const loadedSettings = loadReminderSettings();
    setReminderSettings(loadedSettings);

    // Request notification permission with user-friendly timing
    const requestNotificationPermission = async () => {
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        // Wait a bit before requesting permission for better user experience
        setTimeout(() => {
          Notification.requestPermission().then(permission => {
            if (permission === 'denied') {
              // Add a system notification about permission being denied
              addSystemNotification(
                '提醒功能受限',
                '桌面通知权限已被拒绝，某些提醒功能可能无法正常工作。您可以在浏览器设置中重新启用通知权限。',
                'warning'
              );
            }
          });
        }, 3000);
      }
    };
    
    requestNotificationPermission();
  }, []);

  // Persistence
  useEffect(() => {
    saveEvents(events);
  }, [events]);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    saveReminderSettings(reminderSettings);
  }, [reminderSettings]);

  // Helper function to add a new notification
  const addNotification = (title: string, message: string, type: Notification['type'], relatedEventId?: string) => {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      title,
      message,
      type,
      relatedEventId,
      isRead: false,
      timestamp: new Date(),
      dismissed: false
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Clear old notifications based on settings
      if (reminderSettings.maxHistoryItems > 0) {
        return clearOldNotifications(updated, reminderSettings.maxHistoryItems);
      }
      return updated;
    });

    // Show desktop notification if enabled
    if (reminderSettings.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: relatedEventId || undefined
      });
    }

    // Play sound if enabled
    if (reminderSettings.soundNotifications && notificationSoundRef.current) {
      notificationSoundRef.current.play().catch(e => {
        console.error('Failed to play notification sound:', e);
      });
    }

    return newNotification.id;
  };

  // Helper function to add system notifications
  const addSystemNotification = (title: string, message: string, type: Notification['type'] = 'info') => {
    return addNotification(title, message, type);
  };

  // Helper function to play reminder sound
  const playReminderSound = () => {
    if (reminderSettings.soundNotifications && notificationSoundRef.current) {
      notificationSoundRef.current.currentTime = 0;
      notificationSoundRef.current.play().catch(e => {
        console.error('Failed to play reminder sound:', e);
      });
    }
  };

  // Enhanced Reminder System
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const nowMs = now.getTime();
      
      setEvents(prevEvents => {
        return prevEvents.map(event => {
          if (!event.reminderEnabled || event.notified) return event;

          const eventStart = new Date(event.start).getTime();
          const reminderMs = event.reminderMinutes * 60 * 1000;
          const reminderTime = eventStart - reminderMs;
          
          // Check if it's time for the reminder
          if (nowMs >= reminderTime && nowMs < eventStart) {
            // Calculate time remaining
            const minutesRemaining = Math.max(0, Math.round((eventStart - nowMs) / 60000));
            
            // Add notification
            addNotification(
              `日程提醒: ${event.title}`,
              minutesRemaining > 0 ? `将在 ${minutesRemaining} 分钟后开始。` : '即将开始！',
              'reminder',
              event.id
            );
            
            // Update event as notified
            return { ...event, notified: true };
          }
          
          // Reset notification status if event is in the past and has been notified
          if (nowMs >= eventStart && event.notified) {
            return { ...event, notified: false };
          }
          
          return event;
        });
      });
    };

    // Check reminders every minute for better performance
    notificationIntervalRef.current = setInterval(checkReminders, 60000);
    
    // Initial check immediately
    checkReminders();
    
    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
        notificationIntervalRef.current = null;
      }
    };
  }, [reminderSettings]);

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
        reminderMinutes: reminderSettings.defaultReminderMinutes
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
  
  // Notification Management Functions
  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(notification => 
      notification.id === id ? { ...notification, isRead: true } : notification
    ));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(notification => ({ ...notification, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Settings Management Functions
  const updateReminderSettings = (newSettings: Partial<ReminderSettings>) => {
    setReminderSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetReminderSettings = () => {
    setReminderSettings({
      desktopNotifications: true,
      soundNotifications: true,
      defaultReminderMinutes: 15,
      reminderSound: 'default',
      showReminderHistory: true,
      maxHistoryItems: 50
    });
    addSystemNotification('提醒设置已重置', '提醒设置已恢复为默认值。', 'success');
  };

  // UI Panel Control
  const toggleNotificationPanel = () => setShowNotificationPanel(!showNotificationPanel);
  const toggleSettingsPanel = () => setShowSettingsPanel(!showSettingsPanel);
  const closeAllPanels = () => {
    setShowNotificationPanel(false);
    setShowSettingsPanel(false);
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
          <div className="flex items-center gap-2">
            <button
              onClick={toggleNotificationPanel}
              className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.isRead && !n.dismissed).length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <button
              onClick={toggleSettingsPanel}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
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

      {/* Notification Panel */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out md:w-96
        ${showNotificationPanel ? 'translate-x-0' : 'translate-x-full'}
        ${showNotificationPanel && window.innerWidth < 768 ? 'w-full max-w-none' : ''}
      `}>
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">通知</h2>
          <button onClick={closeAllPanels} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-600">共 {notifications.filter(n => !n.dismissed).length} 条通知</span>
            <button onClick={markAllNotificationsAsRead} className="text-sm text-indigo-600 hover:underline">
              全部已读
            </button>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-120px)] overflow-y-auto">
            {notifications.filter(n => !n.dismissed).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>暂无通知</p>
              </div>
            ) : (
              notifications.filter(n => !n.dismissed).map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${notification.isRead ? 'border-gray-100 bg-white' : 'border-indigo-200 bg-indigo-50'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {notification.type === 'reminder' && <Clock className="w-4 h-4 text-indigo-600" />}
                        {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                        {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                        {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
                        <h3 className="font-medium text-gray-900 text-sm">{notification.title}</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(notification.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out md:w-96
        ${showSettingsPanel ? 'translate-x-0' : 'translate-x-full'}
        ${showSettingsPanel && window.innerWidth < 768 ? 'w-full max-w-none' : ''}
      `}>
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">设置</h2>
          <button onClick={closeAllPanels} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">提醒设置</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">桌面通知</span>
                <button
                  onClick={() => updateReminderSettings({ desktopNotifications: !reminderSettings.desktopNotifications })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${reminderSettings.desktopNotifications ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${reminderSettings.desktopNotifications ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">声音提醒</span>
                <button
                  onClick={() => updateReminderSettings({ soundNotifications: !reminderSettings.soundNotifications })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${reminderSettings.soundNotifications ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${reminderSettings.soundNotifications ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">默认提醒时间</span>
                  <span className="text-sm font-medium text-gray-900">{reminderSettings.defaultReminderMinutes} 分钟</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateReminderSettings({ defaultReminderMinutes: Math.max(0, reminderSettings.defaultReminderMinutes - 5) })}
                    className="p-1 rounded-full border border-gray-200 hover:bg-gray-100"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1440"
                    step="5"
                    value={reminderSettings.defaultReminderMinutes}
                    onChange={(e) => updateReminderSettings({ defaultReminderMinutes: Number(e.target.value) })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    onClick={() => updateReminderSettings({ defaultReminderMinutes: Math.min(1440, reminderSettings.defaultReminderMinutes + 5) })}
                    className="p-1 rounded-full border border-gray-200 hover:bg-gray-100"
                  >
                    <ChevronsUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">历史记录</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">保留通知历史</span>
              <button
                onClick={() => updateReminderSettings({ showReminderHistory: !reminderSettings.showReminderHistory })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${reminderSettings.showReminderHistory ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${reminderSettings.showReminderHistory ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            {reminderSettings.showReminderHistory && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">最大历史数量</span>
                  <span className="text-sm font-medium text-gray-900">{reminderSettings.maxHistoryItems}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={reminderSettings.maxHistoryItems}
                  onChange={(e) => updateReminderSettings({ maxHistoryItems: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>
          <button
            onClick={resetReminderSettings}
            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            重置为默认设置
          </button>
        </div>
      </div>

      {/* Global Panel Overlay for Notifications and Settings */}
        <div className={`
          fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden
          transition-all duration-300
          ${showNotificationPanel || showSettingsPanel ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `}
        onClick={() => {
          setShowNotificationPanel(false);
          setShowSettingsPanel(false);
        }}
        >
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