'use client';

import React, { useState, useEffect } from 'react';

// 生成UUID的辅助函数，兼容服务器端渲染
const generateUUID = () => {
  // 检查是否在浏览器环境中
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // 服务器端或不支持crypto.randomUUID时的备选方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
import { CalendarGrid } from './CalendarGrid';
import { Assistant } from './Assistant';
import { CalendarEvent, ChatMessage, CalendarViewMode, Priority, ReminderSettings } from '../types';
import type { Notification } from '../types';
import { loadEvents, saveEvents, loadNotifications, saveNotifications, loadReminderSettings, saveReminderSettings } from '../services/storage';
import { processUserRequest } from '../services/aiService';
import { X, Bell, Clock, ChevronsUp, Minus, ChevronsDown, Sparkles, Check, Trash2, Settings, Info } from 'lucide-react';

const App: React.FC = () => {
  // 基本状态
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showMobileAssistant, setShowMobileAssistant] = useState(false);
  
  // 通知和提醒设置状态
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    desktopNotifications: true,
    appNotifications: true,
    emailNotifications: false,
    defaultReminderMinutes: 15,
    reminderSound: true
  });

  // 确保组件挂载时显示当前日期并初始化数据
  useEffect(() => {
    setCurrentDate(new Date());
    
    try {
      // 加载事件
      let loadedEvents: CalendarEvent[] = [];
      try {
        loadedEvents = loadEvents();
      } catch (err) {
        console.error('Failed to load events:', err);
      }
      
      // 数据迁移 - 确保所有事件都有提醒相关字段
      const migratedEvents = loadedEvents.map(e => ({
        ...e,
        reminderEnabled: e.reminderEnabled !== undefined ? e.reminderEnabled : true,
        reminderMinutes: e.reminderMinutes || 15,
        notified: e.notified || false,
        isCompleted: e.isCompleted || false
      }));
      
      setEvents(migratedEvents);
      
      // 加载通知
      try {
        const loadedNotifications = loadNotifications();
        setNotifications(loadedNotifications);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
      
      // 加载提醒设置
      try {
        const loadedSettings = loadReminderSettings();
        setReminderSettings(loadedSettings);
      } catch (err) {
        console.error('Failed to load reminder settings:', err);
      }
      
      // 请求通知权限
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      // 发送初始化通知
      try {
        const initNotification: Notification = {
          id: generateUUID(),
          title: 'LifeStream 日历已就绪',
          message: '您的日历已成功加载，所有提醒功能已启用。',
          type: 'system',
          isRead: false,
          timestamp: new Date().toISOString()
        };
        
        const updatedNotifications = [initNotification, ...notifications].slice(0, 50);
        setNotifications(updatedNotifications);
        
        try {
          saveNotifications(updatedNotifications);
        } catch (err) {
          console.error('Failed to save initialization notification:', err);
        }
      } catch (err) {
        console.error('Failed to create initialization notification:', err);
      }
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }, []);

  // 数据持久化
  useEffect(() => {
    saveEvents(events);
  }, [events]);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    saveReminderSettings(reminderSettings);
  }, [reminderSettings]);

  // 提醒系统 - 带错误处理和重试机制
  useEffect(() => {
    const checkReminders = () => {
      try {
        const now = new Date();
        
        setEvents(prev => prev.map(event => {
          try {
            if (!event.reminderEnabled) return event;

            const eventStart = new Date(event.start);
            if (isNaN(eventStart.getTime())) {
              console.error('Invalid event start time:', event.start);
              return event;
            }

            const reminderTime = new Date(eventStart.getTime() - event.reminderMinutes * 60 * 1000);
            
            // 重置提醒状态 - 如果事件在未来且提醒时间未到
            if (eventStart > now && reminderTime > now) {
              return { ...event, notified: false };
            }
            
            // 检查是否需要触发提醒且尚未通知
            if (!event.notified && now >= reminderTime && now <= eventStart) {
              // 触发提醒（带重试机制）
              const triggerWithRetry = async (retries = 3) => {
                try {
                  await triggerReminder(event);
                  return true;
                } catch (err) {
                  console.error('Failed to trigger reminder, retrying...', err);
                  if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return triggerWithRetry(retries - 1);
                  }
                  throw err;
                }
              };
              
              triggerWithRetry().catch(err => {
                console.error('Failed to trigger reminder after retries:', err);
              });
              
              return { ...event, notified: true };
            }
          } catch (err) {
            console.error('Error processing reminder for event:', err, event);
          }
          
          return event;
        }));
      } catch (error) {
        console.error('Error in reminder check:', error);
      }
    };

    // 更频繁的检查以提高准确性
    const interval = setInterval(checkReminders, 5000);
    
    // 组件挂载或事件变化时的初始检查
    checkReminders();
    
    return () => clearInterval(interval);
  }, [events]);
  
  // 触发提醒函数
  const triggerReminder = async (event: CalendarEvent): Promise<void> => {
    try {
      // 验证事件数据
      if (!event.title || !event.start) {
        throw new Error('Invalid event data: missing title or start time');
      }

      const eventStart = new Date(event.start);
      if (isNaN(eventStart.getTime())) {
        throw new Error('Invalid event start time format');
      }

      const timeUntilStart = Math.round((eventStart.getTime() - new Date().getTime()) / 60000);
      const reminderMessage = event.description || `将在 ${timeUntilStart > 0 ? timeUntilStart : 0} 分钟后开始。`;
      
      const notificationPromises: Promise<any>[] = [];

      // 桌面通知
      if (reminderSettings.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
        const desktopNotificationPromise = new Promise<void>((resolve, reject) => {
          try {
            const notification = new Notification(`日程提醒: ${event.title}`, {
              body: reminderMessage,
              icon: '/favicon.ico',
              tag: event.id,
              requireInteraction: true,
              data: { eventId: event.id }
            });
            notification.onclick = () => {
              window.focus();
              notification.close();
              resolve();
            };
            notification.onshow = () => resolve();
            notification.onerror = (err) => reject(err);
          } catch (err) {
            reject(err);
          }
        });
        notificationPromises.push(desktopNotificationPromise);
      }
      
      // 应用内通知
      if (reminderSettings.appNotifications) {
        const appNotificationPromise = new Promise<void>((resolve, reject) => {
          try {
                    const notification: Notification = {
                id: generateUUID(),
                title: event.title,
                message: reminderMessage,
                type: 'reminder',
                relatedEventId: event.id,
                isRead: false,
                timestamp: new Date().toISOString()
              };
            
            const newNotifications = [notification, ...notifications];
            setNotifications(newNotifications);
            saveNotifications(newNotifications);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        notificationPromises.push(appNotificationPromise);
      }
      
      // 邮件通知（占位符，未来实现）
      if (reminderSettings.emailNotifications) {
        const emailNotificationPromise = new Promise<void>((resolve) => {
          console.log('Email notification would be sent for:', event.title);
          resolve();
        });
        notificationPromises.push(emailNotificationPromise);
      }
      
      // 等待所有通知完成
      await Promise.allSettled(notificationPromises);
      
    } catch (error) {
      console.error('Error triggering reminder:', error);
      
      // 添加系统错误通知
      try {
        const errorNotification: Notification = {
          id: generateUUID(),
          title: '提醒发送失败',
          message: `无法发送日程 "${event.title || '未知事件'}" 的提醒`,
          type: 'system',
          isRead: false,
          timestamp: new Date().toISOString()
        };
        
        setNotifications(prev => [errorNotification, ...prev]);
        await saveNotifications([errorNotification, ...notifications]);
      } catch (err) {
        console.error('Failed to create error notification:', err);
      }
    }
  };

  // 通知时间格式化
  const formatNotificationTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return '刚刚';
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}小时前`;
    if (diffInMinutes < 2880) return '昨天';
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 通知管理函数
  const markNotificationAsRead = (id: string) => {
    try {
      const updatedNotifications = notifications.map(notification => 
        notification.id === id ? { ...notification, isRead: true } : notification
      );
      setNotifications(updatedNotifications);
      saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = () => {
    try {
      const updatedNotifications = notifications.map(notification => ({ ...notification, isRead: true }));
      setNotifications(updatedNotifications);
      saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = (id: string) => {
    try {
      const updatedNotifications = notifications.filter(notification => notification.id !== id);
      setNotifications(updatedNotifications);
      saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const deleteAllNotifications = () => {
    try {
      setNotifications([]);
      saveNotifications([]);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  // 设置管理函数
  const updateReminderSetting = (key: keyof ReminderSettings, value: any) => {
    try {
      const updatedSettings = { ...reminderSettings, [key]: value };
      setReminderSettings(updatedSettings);
      saveReminderSettings(updatedSettings);
      
      // 添加设置变更通知
        const newNotification: Notification = {
          id: crypto.randomUUID(),
          title: '提醒设置已更新',
          message: `您已更新了提醒设置: ${key === 'desktopNotifications' ? '桌面通知' : 
                    key === 'appNotifications' ? '应用内通知' : 
                    key === 'emailNotifications' ? '邮件通知' : 
                    key === 'defaultReminderMinutes' ? '默认提醒时间' : 
                    key === 'reminderSound' ? '提醒音效' : key}`,
          type: 'system',
          isRead: false,
          timestamp: new Date().toISOString()
        };
      
      const updatedNotifications = [newNotification, ...notifications].slice(0, 50);
      setNotifications(updatedNotifications);
      saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Failed to update reminder setting:', error);
    }
  };

  // 获取未读通知数量
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // 消息发送处理
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
        id: generateUUID(),
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

  // 事件管理函数
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
      e.id === id ? { ...e, reminderEnabled: !e.reminderEnabled, notified: false } : e
    ));
    if (selectedEvent && selectedEvent.id === id) {
      setSelectedEvent(prev => prev ? { ...prev, reminderEnabled: !prev.reminderEnabled, notified: false } : null);
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
      {/* 顶部导航栏 */}
      <header className="px-3 py-2 md:p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm flex-none z-10">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-base md:text-lg">LS</span>
            LifeStream
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 通知中心 */}
          <div className="relative group">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            
            {/* 通知下拉菜单 */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl z-50 border border-gray-100 animate-in fade-in duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">通知中心</h3>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        全部已读
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={deleteAllNotifications}
                        className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto pr-2">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>暂无通知</p>
                      <p className="text-xs mt-1 opacity-70">您的通知将显示在这里</p>
                    </div>
                  ) : (
                    notifications.map(notification => {
                      const relatedEvent = notification.relatedEventId 
                        ? events.find(e => e.id === notification.relatedEventId)
                        : null;
                      
                      return (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${notification.isRead ? 'text-gray-600' : 'bg-indigo-50 text-gray-900'}`}
                          onClick={() => {
                            markNotificationAsRead(notification.id);
                            if (relatedEvent) {
                              setSelectedEvent(relatedEvent);
                              setShowNotifications(false);
                            }
                          }}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{notification.title}</h4>
                              <p className="text-sm mt-1 truncate opacity-80">{notification.message}</p>
                              <div className="text-xs mt-2 text-gray-500 flex items-center gap-2">
                                <span>{formatNotificationTime(notification.timestamp)}</span>
                                {notification.type === 'reminder' && (
                                  <span className="flex items-center gap-1">
                                    <Bell className="w-3 h-3" />
                                    提醒
                                  </span>
                                )}
                                {notification.type === 'system' && (
                                  <span className="flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    系统
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="text-gray-400 hover:text-gray-600 p-1 opacity-0 hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* 通知统计 */}
                {notifications.length > 0 && (
                  <div className="p-3 border-t border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>共 {notifications.length} 条通知</span>
                      <span>{unreadCount} 条未读</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
            
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* 日历主内容 */}
      <div className="flex-1 overflow-hidden p-1 md:p-2 sm:p-4">
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

      {/* 移动设备浮动按钮 */}
      <button
        onClick={() => setShowMobileAssistant(true)}
        className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-transform active:scale-95 z-30"
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-7 h-7" />
      </button>

      {/* AI助手侧边栏 / 移动抽屉 */}
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
          onClick={e => e.stopPropagation()} // 防止点击内部关闭
        >
          <Assistant 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isProcessing={isProcessing}
            onClose={() => setShowMobileAssistant(false)}
          />
        </div>
      </div>

      {/* 事件详情模态框 */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedEvent.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedEvent.start).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {selectedEvent.end && (
                      <> - {new Date(selectedEvent.end).toLocaleString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</>
                    )}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-3">
                {selectedEvent.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">描述</h3>
                    <p className="text-gray-600 leading-relaxed">{selectedEvent.description}</p>
                  </div>
                )}
                
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">状态</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleComplete(selectedEvent.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1
                        ${selectedEvent.isCompleted 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                    >
                      <Check className="w-3 h-3" />
                      {selectedEvent.isCompleted ? '已完成' : '未完成'}
                    </button>
                    
                    <div className="flex-1"></div>
                    
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedEvent.reminderEnabled}
                          onChange={() => handleToggleReminder(selectedEvent.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">提醒</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                {selectedEvent.reminderEnabled && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">提醒时间</h3>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <select 
                        value={selectedEvent.reminderMinutes}
                        onChange={(e) => handleUpdateReminderTime(selectedEvent.id, parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        {REMINDER_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              
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

      {/* 提醒设置模态框 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">提醒设置</h2>
                  <p className="text-sm text-gray-500 mt-1">自定义您的提醒偏好</p>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* 提醒渠道 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">提醒渠道</h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">桌面通知</p>
                          <p className="text-xs text-gray-500">在系统托盘显示提醒</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={reminderSettings.desktopNotifications}
                          onChange={(e) => updateReminderSetting('desktopNotifications', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </label>
                    
                    <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">应用内通知</p>
                          <p className="text-xs text-gray-500">在通知中心显示提醒</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={reminderSettings.appNotifications}
                          onChange={(e) => updateReminderSetting('appNotifications', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </label>
                    
                    <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">邮件通知</p>
                          <p className="text-xs text-gray-500">通过邮件发送提醒</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={reminderSettings.emailNotifications}
                          onChange={(e) => updateReminderSetting('emailNotifications', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </label>
                  </div>
                </div>
                
                {/* 默认提醒时间 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">默认提醒时间</h3>
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <select 
                      value={reminderSettings.defaultReminderMinutes}
                      onChange={(e) => updateReminderSetting('defaultReminderMinutes', parseInt(e.target.value))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    >
                      {REMINDER_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* 提醒音效 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">提醒音效</h3>
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900">播放提醒音效</p>
                        <p className="text-xs text-gray-500">提醒时播放声音</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={reminderSettings.reminderSound}
                        onChange={(e) => updateReminderSetting('reminderSound', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </label>
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  取消
                </button>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors text-sm font-medium"
                >
                  保存设置
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