import React from 'react';
import { CalendarEvent, EventType, Priority } from '../types';
import { Clock, AlertCircle, CheckCircle2, Bell, BellOff, ChevronsUp, Minus, ChevronsDown } from 'lucide-react';
import { formatTime } from '../utils/dateUtils';

interface EventCardProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  onToggleComplete?: (id: string) => void;
  onToggleReminder?: (id: string) => void;
  compact?: boolean;
  style?: React.CSSProperties;
  className?: string;
  timeFormat?: 'start' | 'range';
}

const typeColors: Record<EventType, string> = {
  [EventType.WORK]: 'bg-blue-100 text-blue-800 border-blue-200',
  [EventType.PERSONAL]: 'bg-green-100 text-green-800 border-green-200',
  [EventType.URGENT]: 'bg-red-100 text-red-800 border-red-200',
  [EventType.OTHER]: 'bg-gray-100 text-gray-800 border-gray-200',
};

const getReminderText = (minutes: number) => {
  if (minutes === 0) return "事件开始时";
  if (minutes < 60) return `提前 ${minutes} 分钟`;
  if (minutes === 60) return "提前 1 小时";
  if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`;
  return `提前 ${minutes} 分钟`;
};

const PriorityIcon: React.FC<{ priority: Priority }> = ({ priority }) => {
  switch (priority) {
    case Priority.HIGH:
      return (
        <span title="高优先级" className="flex items-center">
          <ChevronsUp className="w-3.5 h-3.5 text-red-600" />
        </span>
      );
    case Priority.LOW:
      return (
        <span title="低优先级" className="flex items-center">
          <ChevronsDown className="w-3.5 h-3.5 text-blue-400" />
        </span>
      );
    default:
      return null;
  }
};

export const EventCard: React.FC<EventCardProps> = ({ 
  event, 
  onClick, 
  onToggleComplete, 
  onToggleReminder,
  compact,
  style,
  className,
  timeFormat
}) => {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const now = new Date();
  const isPast = end < now;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete?.(event.id);
  };

  const handleReminderToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleReminder?.(event.id);
  };

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      style={style}
      className={`
        cursor-pointer rounded-md border p-2 sm:p-2.5 mb-1 transition-all hover:shadow-md relative group
        ${typeColors[event.type]}
        ${(isPast || event.isCompleted) ? 'opacity-60 grayscale' : 'opacity-100'}
        ${compact ? 'text-xs py-1 px-1.5 truncate' : 'text-sm sm:text-sm'}
        ${className || ''}
      `}
    >
      <div className="flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          {onToggleComplete && (
            <div 
              role="button"
              onClick={handleToggle}
              className="flex-shrink-0 text-current opacity-70 hover:opacity-100 hover:scale-110 transition-all p-1"
            >
              {event.isCompleted ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <div className="w-4 h-4 rounded-full border-[1.5px] border-current" />
              )}
            </div>
          )}
          
          <PriorityIcon priority={event.priority} />

          <span className={`font-semibold truncate ${event.isCompleted ? 'line-through decoration-current' : ''}`}>
            {(timeFormat === 'start' || timeFormat === 'range') && (
              <span className="font-normal opacity-80 mr-1">{formatTime(start)}</span>
            )}
            {event.title}
          </span>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {onToggleReminder && !compact && (
             <div 
               role="button" 
               onClick={handleReminderToggle}
               className={`transition-opacity ${event.reminderEnabled ? 'opacity-100' : 'opacity-30 hover:opacity-100'} p-1`}
               title={event.reminderEnabled ? `提醒: ${getReminderText(event.reminderMinutes)}` : "提醒已关闭"}
             >
               {event.reminderEnabled ? <Bell className="w-4 h-4 fill-current" /> : <BellOff className="w-4 h-4" />}
             </div>
          )}
          {event.type === EventType.URGENT && !compact && <AlertCircle className="w-4 h-4 text-red-600 p-1" />}
        </div>
      </div>
      
      {!compact && (
        <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
          <Clock className="w-3 h-3" />
          <span>{formatTime(start)} - {formatTime(end)}</span>
        </div>
      )}
      
      {event.description && !compact && (
        <p className="mt-1 text-xs truncate opacity-70">{event.description}</p>
      )}
    </div>
  );
};