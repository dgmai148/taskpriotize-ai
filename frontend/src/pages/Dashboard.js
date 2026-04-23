import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi, taskApi } from '../api/client';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({ totalTasks: 0, openTasks: 0, criticalTasks: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const projs = await projectApi.list();
      setProjects(projs);

      // Aggregate stats across projects
      let total = 0, open = 0, critical = 0, scoreSum = 0, scored = 0;
      for (const p of projs) {
        try {
          const tasks = await taskApi.list(p.id);
          total += tasks.length;
          open += tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length;
          critical += tasks.filter(t => t.manual_priority === 'critical').length;
          tasks.forEach(t => {
            if (t.ai_priority_score > 0) { scoreSum += parseFloat(t.ai_priority_score); scored++; }
          });
        } catch {}
      }
      setStats({
        totalTasks: total,
        openTasks: open,
        criticalTasks: critical,
        avgScore: scored > 0 ? (scoreSum / scored).toFixed(1) : 0,
      });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading dashboard...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-value">{stats.totalTasks}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.openTasks}</div>
          <div className="stat-label">Open / In Progress</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.criticalTasks}</div>
          <div className="stat-label">Critical Priority</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.avgScore}%</div>
          <div className="stat-label">Avg AI Score</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Projects</h2>
        </div>
        {projects.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No projects yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {projects.map(p => (
              <div key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                style={{
                  padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{p.description}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{p.task_count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>tasks</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
