import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // month | list

  const loadTasks = useCallback(async () => {
    try {
      const params = user.role === 'developer' ? { my_tasks: 'true' } : {};
      const data = await taskApi.list(params);
      setTasks(data);
    } catch { }
    finally { setLoading(false); }
  }, [user.role]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  if (loading) return <div className="text-center loading-pulse" style={{ padding: 60 }}>Loading calendar...</div>;

  // Group tasks by due date
  const tasksByDate = {};
  tasks.forEach(t => {
    if (!t.due_date) return;
    const dateKey = t.due_date.split('T')[0];
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
    tasksByDate[dateKey].push(t);
  });

  // Calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); };
  const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); };

  const calDays = [];
  // Previous month padding
  const prevDays = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) calDays.push({ day: prevDays - i, current: false, dateKey: null });
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calDays.push({ day: d, current: true, dateKey, isToday: dateKey === todayKey, tasks: tasksByDate[dateKey] || [] });
  }
  // Next month padding
  const remaining = 42 - calDays.length;
  for (let d = 1; d <= remaining; d++) calDays.push({ day: d, current: false, dateKey: null });

  // Upcoming tasks (next 14 days)
  const upcomingDate = new Date();
  const futureDate = new Date(upcomingDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcoming = tasks
    .filter(t => t.due_date && t.status !== 'done')
    .filter(t => { const d = new Date(t.due_date); return d >= upcomingDate && d <= futureDate; })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const overdueTasks = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < today);
  const selectedDateTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];

  return (
    <div className="fade-in">
      <div className="dashboard-header-row mb-lg">
        <div className="dashboard-header">
          <h1>Calendar</h1>
          <p>Task deadlines and schedule overview</p>
        </div>
        <div className="header-actions">
          <div className="tab-bar">
            <button className={`tab-btn ${viewMode === 'month' ? 'tab-active' : ''}`} onClick={() => setViewMode('month')}>Month</button>
            <button className={`tab-btn ${viewMode === 'list' ? 'tab-active' : ''}`} onClick={() => setViewMode('list')}>List</button>
          </div>
        </div>
      </div>

      <div className="stats-grid mb-lg">
        <div className="card stat-card"><div className="stat-value" style={{ color: 'var(--danger)' }}>{overdueTasks.length}</div><div className="stat-label">Overdue</div></div>
        <div className="card stat-card"><div className="stat-value" style={{ color: 'var(--warning)' }}>{upcoming.length}</div><div className="stat-label">Due in 14 days</div></div>
        <div className="card stat-card"><div className="stat-value" style={{ color: 'var(--primary)' }}>{tasks.filter(t => t.due_date).length}</div><div className="stat-label">With deadlines</div></div>
        <div className="card stat-card"><div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{tasks.filter(t => !t.due_date).length}</div><div className="stat-label">No deadline</div></div>
      </div>

      {viewMode === 'month' && (
        <div className="grid-2 mb-lg" style={{ gridTemplateColumns: '1fr 360px' }}>
          {/* Calendar */}
          <div className="card">
            <div className="calendar-nav">
              <button onClick={prevMonth}>&larr;</button>
              <span>{MONTHS[currentMonth]} {currentYear}</span>
              <button onClick={nextMonth}>&rarr;</button>
            </div>
            <div className="calendar-grid-v2">
              {DAYS.map(d => <div key={d} className="cal-v2-header">{d}</div>)}
              {calDays.map((cd, i) => (
                <div key={i}
                  className={`cal-v2-day ${!cd.current ? 'cal-v2-other' : ''} ${cd.isToday ? 'cal-v2-today' : ''} ${cd.dateKey === selectedDate ? 'cal-v2-selected' : ''} ${cd.tasks?.length ? 'cal-v2-has-tasks' : ''}`}
                  onClick={() => cd.dateKey && setSelectedDate(cd.dateKey === selectedDate ? null : cd.dateKey)}>
                  <span className="cal-v2-num">{cd.day}</span>
                  {cd.tasks && cd.tasks.length > 0 && (
                    <div className="cal-v2-dots">
                      {cd.tasks.slice(0, 3).map((t, j) => (
                        <span key={j} className="cal-v2-dot" style={{ background: t.status === 'done' ? 'var(--success)' : new Date(t.due_date) < today ? 'var(--danger)' : 'var(--primary)' }} />
                      ))}
                      {cd.tasks.length > 3 && <span className="cal-v2-more">+{cd.tasks.length - 3}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Side panel */}
          <div>
            {selectedDate ? (
              <div className="card">
                <div className="card-header">
                  <h2>{new Date(selectedDate + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                </div>
                {selectedDateTasks.length === 0 ? (
                  <EmptyState title="No tasks" description="No tasks due on this date." />
                ) : (
                  <div className="cal-task-list">
                    {selectedDateTasks.map(t => (
                      <div key={t.id} className="cal-task-item" onClick={() => navigate(`/projects/${t.project_id}`)}>
                        <div className="cal-task-title">{t.title}</div>
                        <div className="cal-task-meta">
                          <span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span>
                          <span className={`badge badge-${t.manual_priority}`}>{t.manual_priority}</span>
                        </div>
                        {t.assignee_name && <div className="cal-task-assignee">{t.assignee_name}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="card-header"><h2>Upcoming</h2></div>
                {upcoming.length === 0 ? (
                  <EmptyState title="All clear" description="No upcoming deadlines in the next 14 days." />
                ) : (
                  <div className="cal-task-list">
                    {upcoming.slice(0, 10).map(t => {
                      const daysLeft = Math.ceil((new Date(t.due_date) - today) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={t.id} className="cal-task-item" onClick={() => navigate(`/projects/${t.project_id}`)}>
                          <div className="cal-task-title">{t.title}</div>
                          <div className="cal-task-meta">
                            <span className={`badge badge-${t.manual_priority}`}>{t.manual_priority}</span>
                            <span style={{ color: daysLeft <= 2 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: daysLeft <= 2 ? 600 : 400, fontSize: 12 }}>
                              {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {overdueTasks.length > 0 && (
              <div className="card mt-md">
                <div className="card-header"><h2 style={{ color: 'var(--danger)' }}>Overdue ({overdueTasks.length})</h2></div>
                <div className="cal-task-list">
                  {overdueTasks.slice(0, 5).map(t => (
                    <div key={t.id} className="cal-task-item cal-task-overdue" onClick={() => navigate(`/projects/${t.project_id}`)}>
                      <div className="cal-task-title">{t.title}</div>
                      <div className="cal-task-meta">
                        <span className="badge badge-blocked">Overdue</span>
                        <span style={{ fontSize: 12, color: 'var(--danger)' }}>Due {new Date(t.due_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="card">
          <div className="card-header"><h2>All Deadlines</h2></div>
          {Object.keys(tasksByDate).length === 0 ? (
            <EmptyState title="No deadlines" description="No tasks have due dates set." />
          ) : (
            <div className="report-table">
              <table className="data-table">
                <thead><tr><th>Due Date</th><th>Task</th><th>Project</th><th>Status</th><th>Priority</th><th>Assignee</th></tr></thead>
                <tbody>
                  {Object.entries(tasksByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateTasks]) =>
                    dateTasks.map((t, i) => {
                      const overdue = new Date(date) < today && t.status !== 'done';
                      return (
                        <tr key={t.id} className={overdue ? 'row-overdue' : ''} onClick={() => navigate(`/projects/${t.project_id}`)} style={{ cursor: 'pointer' }}>
                          {i === 0 && <td rowSpan={dateTasks.length} className="cal-date-cell">
                            <div className="cal-date-label">{new Date(date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                            {overdue && <span className="badge badge-blocked" style={{ fontSize: 9 }}>Overdue</span>}
                          </td>}
                          <td><strong>{t.title}</strong></td>
                          <td className="text-sm">{t.project_name || '\u2014'}</td>
                          <td><span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                          <td><span className={`badge badge-${t.manual_priority}`}>{t.manual_priority}</span></td>
                          <td className="text-sm">{t.assignee_name || '\u2014'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
