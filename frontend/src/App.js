import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import PMDashboard from './pages/PMDashboard';
import DevDashboard from './pages/DevDashboard';
import ProjectPage from './pages/ProjectPage';
import UserManagement from './pages/UserManagement';
import AuditLogPage from './pages/AuditLogPage';
import MyTasks from './pages/MyTasks';
import KanbanBoard from './pages/KanbanBoard';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import TeamPage from './pages/TeamPage';
import CalendarPage from './pages/CalendarPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function RoleDashboard() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'pm') return <PMDashboard />;
  return <DevDashboard />;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout><RoleDashboard /></Layout></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><Layout><ProjectPage /></Layout></ProtectedRoute>} />
      <Route path="/board/:projectId" element={<ProtectedRoute><Layout><KanbanBoard /></Layout></ProtectedRoute>} />
      <Route path="/my-tasks" element={<ProtectedRoute><Layout><MyTasks /></Layout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><RequireRole roles={['admin', 'pm']}><Layout><ReportsPage /></Layout></RequireRole></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><RequireRole roles={['admin', 'pm']}><Layout><TeamPage /></Layout></RequireRole></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><Layout><CalendarPage /></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><RequireRole roles={['admin']}><Layout><UserManagement /></Layout></RequireRole></ProtectedRoute>} />
      <Route path="/audit-log" element={<ProtectedRoute><RequireRole roles={['admin']}><Layout><AuditLogPage /></Layout></RequireRole></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
