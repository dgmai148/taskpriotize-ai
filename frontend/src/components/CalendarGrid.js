import React, { useState } from 'react';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarGrid({ deadlines = [], onDayClick }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Build deadline lookup
  const deadlineMap = {};
  deadlines.forEach(d => {
    const date = new Date(d.date || d.due_date);
    if (date.getFullYear() === year && date.getMonth() === month) {
      const day = date.getDate();
      if (!deadlineMap[day]) deadlineMap[day] = { count: 0, hasOverdue: false };
      deadlineMap[day].count++;
      if (d.hasOverdue || d.overdue) deadlineMap[day].hasOverdue = true;
    }
  });

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const cells = [];
  // Previous month padding
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevDays = new Date(year, month, 0).getDate();
    cells.push({ day: prevDays - firstDayOfWeek + i + 1, otherMonth: true });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isToday: isCurrentMonth && d === today, deadline: deadlineMap[d] });
  }
  // Next month padding
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) cells.push({ day: i, otherMonth: true });
  }

  return (
    <div>
      <div className="calendar-nav">
        <button onClick={prevMonth}>&lt;</button>
        <span>{MONTHS[month]} {year}</span>
        <button onClick={nextMonth}>&gt;</button>
      </div>
      <div className="calendar-grid">
        {DAYS.map((d, i) => <div key={i} className="cal-header">{d}</div>)}
        {cells.map((c, i) => (
          <div
            key={i}
            className={`cal-day${c.otherMonth ? ' other-month' : ''}${c.isToday ? ' today' : ''}`}
            onClick={() => !c.otherMonth && onDayClick && onDayClick(c.day)}
          >
            {c.day}
            {c.deadline && (
              <div className={`cal-dot ${c.deadline.hasOverdue ? 'has-overdue' : 'has-deadline'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
