import React from 'react';
import App from '../components/App';

export const metadata = {
  title: 'LifeStream - 智能日历',
  description: '智能日历应用，帮助您管理日程安排和任务',
}

export const viewport = {
  themeColor: '#4f46e5',
}

export default function Home() {
  return <App />;
}
