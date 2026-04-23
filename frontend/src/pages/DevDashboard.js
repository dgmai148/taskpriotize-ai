import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import StatCard from '../components/StatCard';
import MiniBarChart from '../components/MiniBarChart';
import ProgressRing from '../components/ProgressRing';
import ActivityFeed from '../components/ActivityFeed';
import EmptyState from '../components/EmptyState';
import { analyticsApi, projectApi, taskApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isYesterday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

function daysLeft(dueDate) {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate) - new Date()) / 86400000);
}

function getGreeting(name) {
  const hour = new Date().getHours();
  const firstName = name ? name.split(' ')[0] : 'there';
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

export default function DevDashboard() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activity, setActivity] = useState([]);
  const [inProgressTasks, setInProgressTasks] = useState([]);
  const [allMyTasks, setAllMyTasks] = useState([]);
  const [reviewTasks, setReviewTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      analyticsApi.myStats(),
      projectApi.list(),
      analyticsApi.myActivity().catch(() => []),
      taskApi.list({ my_tasks: 'true', status: 'in_progress' }),
      taskApi.list({ my_tasks: 'true' }),
      taskApi.list({ my_tasks: 'true', status: 'review' }),
    ])
      .then(([st, pr, act, ip, allTasks, revTasks]) => {
        setStats(st);
        setProjects(pr);
        setActivity(Array.isArray(act) ? act : []);
        setInProgressTasks(Array.isArray(ip) ? ip : ip?.results || []);
        setAllMyTasks(Array.isArray(allTasks) ? allTasks : allTasks?.results || []);
        setReviewTasks(Array.isArray(revTasks) ? revTasks : revTasks?.results || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskApi.update(taskId, { status: newStatus });
      toast.success('Task status updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="dashboard-header">
        <h1>{getGreeting(user?.name)}</h1>
        <p>Loading your dashboard...</p>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card stat-card skeleton" />
          ))}
        </div>
        <div className="grid-2">
          <div className="card skeleton" />
          <div className="card skeleton" />
        </div>
      </div>
    );
  }

  const s = stats?.stats;
  const focusTask = stats?.focus_task;
  const weekStats = stats?.week_stats;
  const monthStats = stats?.month_stats;
  const streakDays = stats?.streak_days || 0;
  const tags = stats?.tags || [];
  const upcomingDeadlines = stats?.upcoming_deadlines || [];
  const recentlyCompleted = stats?.recently_completed || [];

  // Build chart data from recently_completed (last 7 days)
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayStr = d.toISOString().slice(0, 10);
    const count = recentlyCompleted.filter(
      (t) => t.completed_at && t.completed_at.slice(0, 10) === dayStr
    ).length;
    chartData.push({ label: dayLabel, value: count });
  }

  // Standup data
  const yesterdayTasks = recentlyCompleted.filter((t) =>
    isYesterday(t.completed_at)
  );
  const blockedTasks = inProgressTasks.filter(
    (t) => t.status === 'blocked'
  );
  const todayTasks = inProgressTasks.filter((t) => t.status !== 'blocked');

  return (
    <div>
      {/* 1. Dashboard Header */}
      <div className="dashboard-header">
        <h1>{getGreeting(user?.name)}</h1>
        <p>Here's your work overview</p>
      </div>

      {/* 2. Focus Mode Suggestion */}
      {focusTask && (
        <div className="card focus-card">
          <div className="focus-label">RECOMMENDED NEXT TASK</div>
          <div className="focus-title">{focusTask.title}</div>
          <div className="focus-meta">
            <ProgressRing
              value={focusTask.ai_score || 0}
              size={36}
              color="var(--primary)"
              label={Math.round(focusTask.ai_score || 0)}
            />
            <span className={`badge badge-${focusTask.manual_priority || focusTask.priority}`}>
              {focusTask.manual_priority || focusTask.priority}
            </span>
            {focusTask.due_date && (
              <span className="focus-due">Due {formatDate(focusTask.due_date)}</span>
            )}
            {focusTask.story_points != null && (
              <span className="focus-points">{focusTask.story_points} pts</span>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/projects/${focusTask.project_id}`)}
            >
              Start Working
            </button>
          </div>
        </div>
      )}

      {/* 3. Stats Grid */}
      {s && (
        <div className="stats-grid">
          <StatCard
            label="Assigned Tasks"
            value={s.total_assigned}
            color="var(--primary)"
          />
          <StatCard
            label="In Progress"
            value={parseInt(s.in_progress) + parseInt(s.open)}
            color="var(--warning)"
            sub={`${s.in_progress} active`}
          />
          <StatCard
            label="Completed"
            value={s.completed}
            color="var(--success)"
            sub={`${s.completed_points} points`}
          />
          <StatCard
            label="Overdue"
            value={s.overdue}
            color={
              parseInt(s.overdue) > 0
                ? 'var(--danger)'
                : 'var(--text-secondary)'
            }
          />
        </div>
      )}

      {/* 3b. Workload Distribution + Story Points Tracker */}
      {s && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <h3>My Workload Distribution</h3>
            </div>
            {(() => {
              const statuses = [
                { label: 'Open', value: parseInt(s.open) || 0, color: 'var(--primary)' },
                { label: 'In Progress', value: parseInt(s.in_progress) || 0, color: 'var(--warning)' },
                { label: 'In Review', value: parseInt(s.in_review) || 0, color: '#3b82f6' },
                { label: 'Blocked', value: parseInt(s.blocked) || 0, color: 'var(--danger)' },
              ];
              const total = statuses.reduce((sum, item) => sum + item.value, 0) || 1;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
                  {statuses.map((item) => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                        <span>{item.label}</span>
                        <span style={{ fontWeight: 600 }}>{item.value}</span>
                      </div>
                      <div className="progress-bar" style={{ height: 8, background: 'var(--bg-secondary, #e5e7eb)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(item.value / total) * 100}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Story Points Tracker</h3>
            </div>
            {(() => {
              const completed = parseInt(s.completed_points) || 0;
              const remaining = parseInt(s.remaining_points) || 0;
              const total = completed + remaining || 1;
              const pct = Math.round((completed / total) * 100);
              return (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <ProgressRing value={pct} size={80} color="var(--success)" label={`${pct}%`} />
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{completed}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Completed</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>{remaining}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Remaining</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{completed + remaining}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. Productivity Stats */}
      <div className="card">
        <div className="card-header">
          <h3>Productivity</h3>
          {streakDays > 0 && (
            <span className="streak-badge">
              🔥 {streakDays} day streak
            </span>
          )}
        </div>
        <div className="stats-grid">
          <div className="card stat-card">
            <div className="stat-value">{weekStats?.tasks_completed ?? 0}</div>
            <div className="stat-label">This Week Tasks</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{weekStats?.points_completed ?? 0}</div>
            <div className="stat-label">This Week Points</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{monthStats?.tasks_completed ?? 0}</div>
            <div className="stat-label">This Month Tasks</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value">{monthStats?.points_completed ?? 0}</div>
            <div className="stat-label">This Month Points</div>
          </div>
        </div>
        <MiniBarChart data={chartData} height={80} showLabels color="var(--primary)" />
      </div>

      {/* 4b. Priority Breakdown + Personal Velocity */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Priority Breakdown</h3>
          </div>
          {(() => {
            const priorityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
            allMyTasks.forEach((t) => {
              const p = (t.manual_priority || t.priority || 'medium').toLowerCase();
              if (priorityCounts.hasOwnProperty(p)) priorityCounts[p]++;
            });
            const priorityConfig = [
              { key: 'critical', label: 'Critical', color: 'var(--danger)' },
              { key: 'high', label: 'High', color: 'var(--warning)' },
              { key: 'medium', label: 'Medium', color: 'var(--primary)' },
              { key: 'low', label: 'Low', color: 'var(--text-secondary)' },
            ];
            const total = Object.values(priorityCounts).reduce((a, b) => a + b, 0) || 1;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
                {priorityConfig.map((pc) => (
                  <div key={pc.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge badge-${pc.key}`} style={{ minWidth: 64, textAlign: 'center' }}>{pc.label}</span>
                    <div className="progress-bar" style={{ flex: 1, height: 8, background: 'var(--bg-secondary, #e5e7eb)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(priorityCounts[pc.key] / total) * 100}%`, height: '100%', background: pc.color, borderRadius: 4, transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontWeight: 600, minWidth: 24, textAlign: 'right', fontSize: '0.85rem' }}>{priorityCounts[pc.key]}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Personal Velocity</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last 4 weeks</span>
          </div>
          {(() => {
            const weeks = [];
            for (let w = 3; w >= 0; w--) {
              const weekEnd = new Date();
              weekEnd.setDate(weekEnd.getDate() - w * 7);
              const weekStart = new Date(weekEnd);
              weekStart.setDate(weekStart.getDate() - 7);
              const count = recentlyCompleted.filter((t) => {
                if (!t.completed_at) return false;
                const d = new Date(t.completed_at);
                return d >= weekStart && d < weekEnd;
              }).length;
              const label = w === 0 ? 'This Week' : w === 1 ? 'Last Week' : `${w}w ago`;
              weeks.push({ label, count });
            }
            const maxCount = Math.max(...weeks.map((w) => w.count), 1);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
                {weeks.map((w, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                      <span>{w.label}</span>
                      <span style={{ fontWeight: 600 }}>{w.count} tasks</span>
                    </div>
                    <div className="progress-bar" style={{ height: 8, background: 'var(--bg-secondary, #e5e7eb)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(w.count / maxCount) * 100}%`, height: '100%', background: 'var(--success)', borderRadius: 4, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 5. Daily Standup Summary */}
      <div className="card">
        <div className="card-header">
          <h3>Daily Standup</h3>
        </div>
        <div className="standup">
          <div className="standup-section standup-yesterday">
            <h4>Yesterday</h4>
            {yesterdayTasks.length > 0 ? (
              yesterdayTasks.map((t) => (
                <div key={t.id} className="standup-item">
                  <span className="standup-check">&#10003;</span> {t.title}
                </div>
              ))
            ) : (
              <div className="standup-empty">No tasks completed yesterday</div>
            )}
          </div>
          <div className="standup-section standup-today">
            <h4>Today</h4>
            {todayTasks.length > 0 ? (
              todayTasks.map((t) => (
                <div key={t.id} className="standup-item">
                  <span className="standup-dot">&#8226;</span> {t.title}
                </div>
              ))
            ) : (
              <div className="standup-empty">No tasks in progress</div>
            )}
          </div>
          <div className="standup-section standup-blockers">
            <h4>Blockers</h4>
            {blockedTasks.length > 0 ? (
              blockedTasks.map((t) => (
                <div key={t.id} className="standup-item">
                  <span className="standup-warn">&#9888;</span> {t.title}
                </div>
              ))
            ) : (
              <div className="standup-empty">No blockers</div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Quick Status Update */}
      <div className="card">
        <div className="card-header">
          <h3>Quick Status Update</h3>
        </div>
        {inProgressTasks.length > 0 ? (
          inProgressTasks.slice(0, 5).map((t) => (
            <div key={t.id} className="quick-update-row">
              <span className="quick-update-title">{t.title}</span>
              <select
                className="quick-update-select"
                value={t.status}
                onChange={(e) => handleStatusChange(t.id, e.target.value)}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          ))
        ) : (
          <EmptyState
            title="No tasks in progress"
            description="Pick up a task to get started"
            actionLabel="View My Tasks"
            onAction={() => navigate('/my-tasks')}
          />
        )}
      </div>

      {/* 6b. Review Tasks */}
      <div className="card">
        <div className="card-header">
          <h3>Review Tasks</h3>
          {reviewTasks.length > 0 && (
            <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>{reviewTasks.length}</span>
          )}
        </div>
        {reviewTasks.length > 0 ? (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Task</th>
                <th>Priority</th>
                <th>Points</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reviewTasks.slice(0, 8).map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>
                    <span className={`badge badge-${t.manual_priority || t.priority}`}>
                      {t.manual_priority || t.priority}
                    </span>
                  </td>
                  <td>{t.story_points != null ? `${t.story_points} pts` : '-'}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => navigate(`/projects/${t.project_id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No tasks awaiting review" description="All clear for now" />
        )}
      </div>

      {/* 7. Activity Feed + Upcoming Deadlines */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <ActivityFeed items={activity} />
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Upcoming Deadlines</h3>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => navigate('/my-tasks')}
            >
              View All Tasks
            </button>
          </div>
          {upcomingDeadlines.length > 0 ? (
            upcomingDeadlines.map((t) => {
              const dl = daysLeft(t.due_date);
              const isOverdue = dl !== null && dl < 0;
              const isUrgent = dl !== null && dl >= 0 && dl <= 3;
              return (
                <div key={t.id} className="deadline-row">
                  <div className="deadline-info">
                    <div className="deadline-title">{t.title}</div>
                    <div className="deadline-meta">
                      <span
                        className={`badge badge-${t.manual_priority || t.priority}`}
                      >
                        {t.manual_priority || t.priority}
                      </span>
                      <ProgressRing
                        value={t.ai_score || 0}
                        size={28}
                        color="var(--primary)"
                        label={Math.round(t.ai_score || 0)}
                      />
                    </div>
                  </div>
                  <div
                    className="deadline-days"
                    style={{
                      color: isOverdue
                        ? 'var(--danger)'
                        : isUrgent
                          ? 'var(--warning)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {isOverdue
                      ? `${Math.abs(dl)}d overdue`
                      : dl === 0
                        ? 'Due today'
                        : `${dl}d left`}
                    <div className="deadline-date">
                      {formatDate(t.due_date)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="standup-empty">No upcoming deadlines</div>
          )}
        </div>
      </div>

      {/* 8. Skill / Tag Cloud */}
      {tags && tags.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>My Skills &amp; Tags</h3>
          </div>
          <div className="tag-cloud">
            {tags.map((tag, i) => (
              <span
                key={i}
                className={`tag-pill${tag.count > 2 ? ' tag-lg' : ''}`}
              >
                {tag.name || tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 9. Projects + Recently Completed */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Projects</h3>
          </div>
          {projects.length > 0 ? (
            projects.map((p) => {
              const progress =
                p.task_count > 0
                  ? Math.round((p.done_count / p.task_count) * 100)
                  : 0;
              return (
                <div
                  key={p.id}
                  className="workload-row"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <ProgressRing
                    value={progress}
                    size={36}
                    color="var(--primary)"
                  />
                  <div className="workload-info">
                    <div className="workload-name">{p.name}</div>
                    <div className="workload-meta">
                      {p.task_count} tasks &middot; {p.done_count || 0} done
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState title="No projects yet" />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recently Completed</h3>
          </div>
          {recentlyCompleted.length > 0 ? (
            recentlyCompleted.map((t) => (
              <div key={t.id} className="completed-row">
                <div className="completed-title">{t.title}</div>
                <div className="completed-meta">
                  {t.story_points != null && (
                    <span className="completed-points">
                      {t.story_points} pts
                    </span>
                  )}
                  <span className="completed-date">
                    {t.completed_at ? formatDate(t.completed_at) : ''}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="No completed tasks yet" />
          )}
        </div>
      </div>
    </div>
  );
}
