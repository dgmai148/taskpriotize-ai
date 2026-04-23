import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const demoCredentials = [
  { role: 'Admin', email: 'admin@taskprio.com', password: 'admin123', description: 'Full system access — users, projects, audit logs, analytics', icon: 'shield', gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)' },
  { role: 'Project Manager', email: 'pm@taskprio.com', password: 'pm123', description: 'Manage projects, assign tasks, track team velocity', icon: 'briefcase', gradient: 'linear-gradient(135deg, #2563eb, #60a5fa)' },
  { role: 'Developer', email: 'dev@taskprio.com', password: 'dev123', description: 'View tasks, update progress, track productivity', icon: 'code', gradient: 'linear-gradient(135deg, #059669, #34d399)' },
];

const ICONS = {
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  briefcase: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>,
  code: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
};

const FEATURES = [
  { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>, title: 'AI Prioritization', desc: 'ML-powered scoring with SHAP explanations' },
  { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>, title: 'Kanban Boards', desc: 'Visual workflow with real-time updates' },
  { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, title: 'Analytics', desc: 'Team velocity, trends, and health metrics' },
  { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, title: 'Team Management', desc: 'Role-based access and workload tracking' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCred, setSelectedCred] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Please enter both email and password.'); return; }
    setLoading(true);
    try { await login(email, password); } catch (err) { setError(err.message || 'Login failed. Please check your credentials.'); } finally { setLoading(false); }
  };

  const fillCredentials = (cred, index) => { setEmail(cred.email); setPassword(cred.password); setSelectedCred(index); setError(''); };

  return (
    <div className="login-page-v2">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
        <div className="login-bg-grid" />
      </div>

      <div className={`login-container ${mounted ? 'login-mounted' : ''}`}>
        {/* Left panel — branding */}
        <div className="login-left">
          <div className="login-brand">
            <div className="login-logo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <h1 className="login-title">TaskPrio AI</h1>
            <p className="login-tagline">Intelligent Task Prioritization Platform</p>
          </div>

          <div className="login-features">
            {FEATURES.map((f, i) => (
              <div key={i} className="login-feature" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
                <div className="login-feature-icon">{f.icon}</div>
                <div>
                  <div className="login-feature-title">{f.title}</div>
                  <div className="login-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="login-footer-text">
            Powered by GradientBoosting + SHAP Explainability
          </div>
        </div>

        {/* Right panel — form */}
        <div className="login-right">
          <div className="login-form-wrapper">
            <h2 className="login-form-title">Welcome back</h2>
            <p className="login-form-subtitle">Sign in to your account to continue</p>

            {error && (
              <div className="login-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label>Email Address</label>
                <div className="login-input-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="Enter your email" required autoComplete="email" />
                </div>
              </div>

              <div className="login-field">
                <label>Password</label>
                <div className="login-input-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder="Enter your password" required autoComplete="current-password" />
                </div>
              </div>

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? (<><span className="spinner" /> Signing in...</>) : (<>Sign In <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>)}
              </button>
            </form>

            <div className="login-divider">
              <span>Quick Access — Demo Accounts</span>
            </div>

            <div className="login-demo-grid">
              {demoCredentials.map((cred, idx) => (
                <button key={idx} type="button" className={`login-demo-card ${selectedCred === idx ? 'login-demo-active' : ''}`}
                  onClick={() => fillCredentials(cred, idx)}>
                  <div className="login-demo-icon" style={{ background: cred.gradient }}>
                    {ICONS[cred.icon]}
                  </div>
                  <div className="login-demo-info">
                    <div className="login-demo-role">
                      {cred.role}
                      {selectedCred === idx && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div className="login-demo-desc">{cred.description}</div>
                  </div>
                </button>
              ))}
            </div>

            <p className="login-hint">Click a demo account, then sign in</p>
          </div>
        </div>
      </div>
    </div>
  );
}
