import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { userApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const COLOR_SWATCHES = [
  { value: '#4f46e5', label: 'Indigo' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#16a34a', label: 'Green' },
  { value: '#d97706', label: 'Amber' },
  { value: '#dc2626', label: 'Red' },
  { value: '#9333ea', label: 'Purple' },
  { value: '#e11d48', label: 'Rose' },
];

function getRoleBadgeStyle(role) {
  if (role === 'admin') return { background: 'var(--critical-bg)', color: '#6d28d9' };
  if (role === 'pm') return { background: 'var(--warning-bg)', color: '#92400e' };
  return { background: '#dbeafe', color: '#1e40af' };
}

export default function ProfilePage() {
  const { user, login } = useAuth();

  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#4f46e5');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarColor(user.avatar_color || '#4f46e5');
    }
  }, [user]);

  async function handleProfileSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await userApi.updateProfile({ name: name.trim(), avatar_color: avatarColor });
      // Refresh user context by re-fetching via authApi.me - but since we don't have
      // a refreshUser on context, we update local state to reflect changes immediately.
      // The user object from context won't auto-update, but the page shows the latest.
      if (updated && updated.user) {
        // Some backends return the updated user
      }
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error('Failed to update profile: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast.error('Current password is required');
      return;
    }
    if (!newPassword.trim()) {
      toast.error('New password is required');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await userApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error('Failed to change password: ' + err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  if (!user) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading profile...</div>;
  }

  const displayName = name || user.name || '';
  const displayColor = avatarColor || user.avatar_color || '#4f46e5';

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Profile Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Manage your account information and preferences
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Large Avatar */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: displayColor,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 36,
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {getInitials(displayName)}
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
              {user.name}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>
              {user.email}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="badge" style={getRoleBadgeStyle(user.role)}>
                {user.role}
              </span>
              {user.created_at && (
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    style={{ verticalAlign: 'middle', marginRight: 4 }}
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Joined {formatDate(user.created_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Edit Profile Card */}
        <div className="card">
          <div className="card-header">
            <h2>
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                style={{ verticalAlign: 'middle', marginRight: 8 }}
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Edit Profile
            </h2>
          </div>

          <form onSubmit={handleProfileSave}>
            <div className="form-group">
              <label>Name</label>
              <input
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                className="form-input"
                value={user.email || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                Email cannot be changed. Contact an administrator.
              </span>
            </div>

            <div className="form-group">
              <label>Role</label>
              <input
                className="form-input"
                value={(user.role || '').charAt(0).toUpperCase() + (user.role || '').slice(1)}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed', textTransform: 'capitalize' }}
              />
            </div>

            <div className="form-group">
              <label>Avatar Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {COLOR_SWATCHES.map(swatch => (
                  <button
                    key={swatch.value}
                    type="button"
                    title={swatch.label}
                    onClick={() => setAvatarColor(swatch.value)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: swatch.value,
                      border: avatarColor === swatch.value
                        ? '3px solid var(--text)'
                        : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      outline: avatarColor === swatch.value
                        ? '2px solid var(--primary-light)'
                        : 'none',
                      outlineOffset: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {avatarColor === swatch.value && (
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: avatarColor,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {getInitials(name)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Preview</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {name || 'Your Name'}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingProfile}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {savingProfile ? (
                <><span className="spinner" /> Saving...</>
              ) : (
                <>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save Profile
                </>
              )}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="card">
          <div className="card-header">
            <h2>
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                style={{ verticalAlign: 'middle', marginRight: 8 }}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Change Password
            </h2>
          </div>

          <form onSubmit={handlePasswordSave}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                className="form-input"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                className="form-input"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                minLength={6}
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <span style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                  Passwords do not match
                </span>
              )}
              {confirmPassword && newPassword === confirmPassword && confirmPassword.length >= 6 && (
                <span style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, display: 'block' }}>
                  Passwords match
                </span>
              )}
            </div>

            <div
              style={{
                padding: 12,
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
                Password requirements:
              </div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>Minimum 6 characters long</li>
                <li>Must provide your current password for verification</li>
              </ul>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {savingPassword ? (
                <><span className="spinner" /> Changing...</>
              ) : (
                <>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Change Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
