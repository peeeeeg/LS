import React, { useMemo, useRef, useEffect } from 'react';
import { CalendarEvent, CalendarViewMode } from '../types';
import { getDaysInMonth, getWeekDays, isSameDay } from '../utils/dateUtils';
import { EventCard } from './EventCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarGridProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  events: CalendarEvent[];
  onMonthChange: (date: Date) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onEventClick: (event: CalendarEvent) => void;
  onToggleComplete: (id: string) => void;
  onToggleReminder: (id: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_HEIGHT = 60; // Height of one hour in pixels

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  viewMode,
  events,
  onMonthChange,
  onViewModeChange,
  onEventClick,
  onToggleComplete,
  onToggleReminder
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current time in week/day view on mount or view change
  useEffect(() => {
    if ((viewMode === 'week' || viewMode === 'day') && scrollRef.current) {
      const currentHour = new Date().getHours();
      // Scroll to 1 hour before current time to give context
      const scrollTo = Math.max(0, (currentHour - 1) * CELL_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, [viewMode]);

  const monthViewDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthDays = getDaysInMonth(year, month);
    const firstDay = monthDays[0].getDay();
    const prefixDays = Array(firstDay).fill(null);
    return [...prefixDays, ...monthDays];
  }, [currentDate]);

  const monthName = currentDate.toLocaleDateString('zh-CN', { month: 'long', year: 'numeric' });
  const today = new Date();

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    onMonthChange(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    onMonthChange(newDate);
  };

  const renderMonthView = () => {
    return (
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 flex-none">
          {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(day => (
            <div key={day} className="py-2 md:py-3 text-center text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto bg-white">
          {monthViewDays.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="bg-gray-50/30 border-b border-r border-gray-100 min-h-[80px]" />;
            const dayEvents = events.filter(e => isSameDay(new Date(e.start), day));
            const isToday = isSameDay(day, today);
            return (
              <div key={day.toISOString()} className="min-h-[80px] p-1 md:p-2 border-b border-r border-gray-100 hover:bg-gray-50 flex flex-col gap-1 overflow-hidden relative transition-colors">
                <div className={`text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                  {day.getDate()}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                  {dayEvents.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      onClick={onEventClick} 
                      onToggleComplete={onToggleComplete}
                      onToggleReminder={onToggleReminder}
                      compact={true}
                      timeFormat="start"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeGridEvents = (day: Date) => {
    const dayEvents = events.filter(e => isSameDay(new Date(e.start), day));
    
    return dayEvents.map(event => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      
      const top = startMinutes * (CELL_HEIGHT / 60);
      const height = Math.max(durationMinutes * (CELL_HEIGHT / 60), 24); // Minimum height

      return (
        <EventCard
          key={event.id}
          event={event}
          onClick={onEventClick}
          onToggleComplete={onToggleComplete}
          onToggleReminder={onToggleReminder}
          compact={true}
          timeFormat="range"
          style={{ 
            top: `${top}px`, 
            height: `${height}px`,
            position: 'absolute' 
          }}
          className="left-1 right-1 z-10 shadow-sm text-xs overflow-hidden absolute"
        />
      );
    });
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);

    // Using a single unified grid with sticky headers for robust mobile scrolling
    return (
      <div className="flex-1 overflow-auto bg-white relative" ref={scrollRef}>
        <div className="min-w-[600px] md:min-w-0"> {/* Min width forces horizontal scroll on mobile */}
          <div className="grid grid-cols-8 relative">
            
            {/* Top-Left Corner (Sticky) */}
            <div className="sticky left-0 top-0 z-40 bg-gray-50 border-r border-b border-gray-200 h-[60px]"></div>
            
            {/* Header Row (Sticky Top) */}
            {weekDays.map(day => {
              const isToday = isSameDay(day, today);
              return (
                <div key={`header-${day}`} className="sticky top-0 z-30 bg-gray-50 border-b border-r border-gray-100 py-2 md:py-3 text-center h-[60px] flex flex-col items-center justify-center">
                  <span className={`text-xs uppercase font-semibold ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>
                    {day.toLocaleDateString('zh-CN', { weekday: 'short' })}
                  </span>
                  <span className={`mt-1 w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full text-sm md:text-lg font-medium ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-800'}`}>
                    {day.getDate()}
                  </span>
                </div>
              );
            })}

            {/* Time Column (Sticky Left) */}
            <div className="sticky left-0 z-20 bg-white border-r border-gray-200">
               {HOURS.map(hour => (
                  <div key={`time-${hour}`} style={{ height: CELL_HEIGHT }} className="text-xs text-gray-400 text-right pr-2 pt-1 border-b border-transparent relative">
                     <span className="-top-3 relative">{hour}:00</span>
                  </div>
               ))}
            </div>

            {/* Event Columns */}
            {weekDays.map(day => (
              <div key={`col-${day}`} className="border-r border-gray-100 relative bg-white">
                {/* Current time indicator */}
                {isSameDay(day, today) && (
                   <div 
                     className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                     style={{ top: `${(today.getHours() * 60 + today.getMinutes()) * (CELL_HEIGHT / 60)}px` }}
                   >
                     <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                   </div>
                )}
                
                {/* Grid Lines */}
                {HOURS.map(hour => (
                   <div key={`cell-${day}-${hour}`} style={{ height: CELL_HEIGHT }} className="border-b border-gray-100"></div>
                ))}
                
                {/* Events */}
                {renderTimeGridEvents(day)}
              </div>
            ))}

          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    return (
      <div className="flex-1 overflow-auto bg-white relative" ref={scrollRef}>
          <div className="flex min-h-[800px]"> {/* Ensure min height */}
            
            {/* Time Labels (Sticky Left) */}
            <div className="w-16 md:w-20 flex-none border-r border-gray-200 bg-white sticky left-0 z-20">
              {HOURS.map(hour => (
                <div key={hour} style={{ height: CELL_HEIGHT }} className="text-xs text-gray-400 text-right pr-2 md:pr-4 pt-1 border-b border-transparent relative">
                   <span className="-top-3 relative">{hour}:00</span>
                </div>
              ))}
            </div>
            
            {/* The Day Column */}
            <div className="flex-1 relative bg-white">
               {/* Header for Day View inside scroll area to save external space */}
               <div className="sticky top-0 z-30 bg-gray-50 border-b border-gray-200 p-2 text-center">
                  <span className={`text-base md:text-lg font-semibold ${isSameDay(currentDate, today) ? 'text-indigo-600' : 'text-gray-800'}`}>
                    {currentDate.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
               </div>

               {/* Current time line */}
               {isSameDay(currentDate, today) && (
                   <div 
                     className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                     style={{ top: `${(today.getHours() * 60 + today.getMinutes()) * (CELL_HEIGHT / 60)}px` }}
                   >
                     <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                     <span className="text-xs text-red-500 bg-white px-1 ml-1 font-medium">
                        {today.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit', hour12: false})}
                     </span>
                   </div>
                )}

              {HOURS.map(hour => (
                 <div key={hour} style={{ height: CELL_HEIGHT }} className="border-b border-gray-100"></div>
              ))}
              {renderTimeGridEvents(currentDate)}
            </div>
          </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 border-b border-gray-200 bg-white flex-none z-10 gap-3">
        
        {/* Title and View Switcher */}
        <div className="flex items-center justify-between md:justify-start gap-2 md:gap-4">
           <h2 className="text-lg md:text-2xl font-bold text-gray-800 truncate">
             {viewMode === 'day' ? '日程详情' : monthName}
           </h2>
           <div className="flex bg-gray-100 rounded-lg p-1 gap-1 flex-shrink-0">
             <button 
               onClick={() => onViewModeChange('month')}
               className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
             >
               月
             </button>
             <button 
               onClick={() => onViewModeChange('week')}
               className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded-md transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
             >
               周
             </button>
             <button 
               onClick={() => onViewModeChange('day')}
               className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded-md transition-all ${viewMode === 'day' ? 'bg-white text-indigo-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
             >
               日
             </button>
           </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between md:justify-end gap-2">
          <div className="flex gap-1">
            <button onClick={handlePrev} className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors border border-gray-200">
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
            </button>
            <button onClick={() => onMonthChange(new Date())} className="px-3 py-1 text-xs md:text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-100">
              今天
            </button>
            <button onClick={handleNext} className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors border border-gray-200">
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}
    </div>
  );
};