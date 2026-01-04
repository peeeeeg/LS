// 2026年中国法定节假日数据
export interface Holiday {
  name: string;
  isWorkDay?: boolean; // 是否是调休工作日
}

// 节假日数据，键格式：YYYY-MM-DD
export const holidays2026: Record<string, Holiday> = {
  // 元旦
  '2026-01-01': { name: '元旦' },
  // 春节
  '2026-02-21': { name: '春节' },
  '2026-02-22': { name: '春节' },
  '2026-02-23': { name: '春节' },
  '2026-02-24': { name: '春节' },
  '2026-02-25': { name: '春节' },
  '2026-02-26': { name: '春节' },
  '2026-02-27': { name: '春节' },
  // 清明节
  '2026-04-04': { name: '清明节' },
  '2026-04-05': { name: '清明节' },
  '2026-04-06': { name: '清明节' },
  // 劳动节
  '2026-05-01': { name: '劳动节' },
  '2026-05-02': { name: '劳动节' },
  '2026-05-03': { name: '劳动节' },
  '2026-05-04': { name: '劳动节' },
  '2026-05-05': { name: '劳动节' },
  // 端午节
  '2026-06-20': { name: '端午节' },
  '2026-06-21': { name: '端午节' },
  '2026-06-22': { name: '端午节' },
  // 中秋节
  '2026-09-26': { name: '中秋节' },
  '2026-09-27': { name: '中秋节' },
  '2026-09-28': { name: '中秋节' },
  // 国庆节
  '2026-10-01': { name: '国庆节' },
  '2026-10-02': { name: '国庆节' },
  '2026-10-03': { name: '国庆节' },
  '2026-10-04': { name: '国庆节' },
  '2026-10-05': { name: '国庆节' },
  '2026-10-06': { name: '国庆节' },
  '2026-10-07': { name: '国庆节' },
  // 调休工作日
  '2026-02-15': { name: '春节调休', isWorkDay: true },
  '2026-02-28': { name: '春节调休', isWorkDay: true },
  '2026-04-09': { name: '清明节调休', isWorkDay: true },
  '2026-04-30': { name: '劳动节调休', isWorkDay: true },
  '2026-06-23': { name: '端午节调休', isWorkDay: true },
  '2026-09-29': { name: '中秋节调休', isWorkDay: true },
  '2026-10-10': { name: '国庆节调休', isWorkDay: true },
};

// 获取日期对应的节假日信息
export const getHoliday = (date: Date): Holiday | null => {
  const dateStr = date.toISOString().split('T')[0]; // 转换为YYYY-MM-DD格式
  return holidays2026[dateStr] || null;
};

// 检查是否是法定节假日
export const isHoliday = (date: Date): boolean => {
  const holiday = getHoliday(date);
  return !!holiday && !holiday.isWorkDay;
};

// 检查是否是调休工作日
export const isWorkDayOff = (date: Date): boolean => {
  const holiday = getHoliday(date);
  return !!holiday && holiday.isWorkDay === true;
};

// 获取日期显示样式
export const getHolidayStyleClass = (date: Date): string => {
  if (isHoliday(date)) {
    return 'text-red-600'; // 节假日显示红色
  }
  if (isWorkDayOff(date)) {
    return 'text-gray-400'; // 调休工作日显示灰色
  }
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'text-red-500'; // 周末显示红色
  }
  return 'text-gray-700'; // 正常工作日显示黑色
};
