import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Mail, Phone, Save, KeyRound, Shield, Calendar, Eye, EyeOff,
  Settings, Camera, Trash2, Palette, Check
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import UserAvatar from '../components/UserAvatar';
import SavedPassengersPanel from '../components/SavedPassengersPanel';
import FavoriteRoutesPanel from '../components/FavoriteRoutesPanel';
import GstSettingsPanel from '../components/GstSettingsPanel';
import LoyaltyPanel from '../components/LoyaltyPanel';
import DeviceManagementPanel from '../components/DeviceManagementPanel';
import MfaSetupPanel from '../components/MfaSetupPanel';
import { compressImageForAvatar, isSupportedAvatarFile } from '../utils/avatarImage';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', desc: 'Clean and bright', swatches: ['#F6FAFB', '#12B8B8', '#102A43'] },
  { id: 'dark', label: 'Dark', desc: 'Easy on the eyes', swatches: ['#0b1118', '#12B8B8', '#e8eef2'] },
  { id: 'ocean', label: 'Ocean', desc: 'Cool coastal tones', swatches: ['#e8f4f8', '#0891b2', '#0a3d4d'] }
];

const fileToDataUrl = (file) => compressImageForAvatar(file);

function ProfileContent() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarError, setAvatarError] = useState('');

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name || '', phone: user.phone || '' });
    }
  }, [user]);

  const setPasswordField = (key) => (e) => {
    setPasswords((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileMsg('');
    setProfileLoading(true);
    try {
      await api.put('/auth/profile', profile);
      await refreshUser();
      setProfileMsg('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.message || 'Could not update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMsg('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      const data = await api.put('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      setPasswordMsg(data.msg || 'Password updated successfully.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message || 'Could not change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');
    setAvatarMsg('');

    if (!isSupportedAvatarFile(file)) {
      setAvatarError('Please choose a PNG, JPG, or WEBP image.');
      e.target.value = '';
      return;
    }

    setAvatarLoading(true);
    try {
      const avatarData = await fileToDataUrl(file);
      await api.post('/auth/profile-photo', { avatarData });
      await refreshUser();
      setAvatarMsg('Profile photo updated.');
    } catch (err) {
      setAvatarError(err.message || 'Could not upload photo');
    } finally {
      setAvatarLoading(false);
      e.target.value = '';
    }
  };

  const removeAvatar = async () => {
    setAvatarError('');
    setAvatarMsg('');
    setAvatarLoading(true);
    try {
      await api.del('/auth/profile-photo');
      await refreshUser();
      setAvatarMsg('Profile photo removed.');
    } catch (err) {
      setAvatarError(err.message || 'Could not remove photo');
    } finally {
      setAvatarLoading(false);
    }
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : '—';

  return (
    <div className="profile-page page-shell">
      <section className="profile-hero page-hero">
        <div className="profile-hero-inner page-hero-inner page-hero-split">
          <div className="profile-hero-copy page-hero-copy">
            <span className="profile-badge page-hero-badge">
              <Settings size={14} aria-hidden="true" /> Account
            </span>
            <h1 className="page-hero-title">Profile Settings</h1>
            <p className="page-hero-subtitle">Manage your photo, appearance, personal details, and security.</p>
          </div>

          <div className="profile-hero-avatar-block">
            <div className="profile-hero-avatar-wrap">
              <UserAvatar user={user} size={96} className="profile-hero-avatar" />
              <button
                type="button"
                className="profile-avatar-camera"
                onClick={handleAvatarPick}
                disabled={avatarLoading}
                aria-label="Change profile photo"
              >
                <Camera size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
                className="profile-avatar-input"
                onChange={handleAvatarChange}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm profile-avatar-btn"
                onClick={handleAvatarPick}
                disabled={avatarLoading}
              >
                <Camera size={14} aria-hidden="true" />
                {avatarLoading ? 'Uploading…' : 'Change photo'}
              </button>
              {user?.avatarUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm profile-avatar-btn profile-avatar-remove"
                  onClick={removeAvatar}
                  disabled={avatarLoading}
                >
                  <Trash2 size={14} aria-hidden="true" /> Remove
                </button>
              )}
            </div>
            {avatarError && <p className="profile-inline-error">{avatarError}</p>}
            {avatarMsg && <p className="profile-inline-success">{avatarMsg}</p>}
          </div>
        </div>
      </section>

      <div className="profile-body page-body container">
        <aside className="profile-sidebar card">
          <div className="profile-sidebar-user">
            <UserAvatar user={user} size={52} />
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>

          <h2>Account overview</h2>
          <dl className="profile-summary">
            <div>
              <dt><Mail size={14} aria-hidden="true" /> Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt><Calendar size={14} aria-hidden="true" /> Member since</dt>
              <dd>{memberSince}</dd>
            </div>
            <div>
              <dt><Shield size={14} aria-hidden="true" /> Role</dt>
              <dd>{user?.isAdmin ? 'Administrator' : 'Traveller'}</dd>
            </div>
          </dl>
          <Link to="/bookings" className="btn btn-outline btn-sm btn-block">View my bookings</Link>
        </aside>

        <div className="profile-main">
          <section className="profile-card card">
            <div className="profile-card-head">
              <Palette size={20} aria-hidden="true" />
              <div>
                <h2>Appearance</h2>
                <p>Choose a theme — your preference is saved to your account.</p>
              </div>
            </div>

            <div className="profile-theme-grid" role="radiogroup" aria-label="Theme selection">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === opt.id}
                  className={`profile-theme-option ${theme === opt.id ? 'is-active' : ''}`}
                  onClick={() => setTheme(opt.id)}
                >
                  <div className="profile-theme-swatches" aria-hidden="true">
                    {opt.swatches.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </div>
                  <div className="profile-theme-meta">
                    <strong>{opt.label}</strong>
                    <span>{opt.desc}</span>
                  </div>
                  {theme === opt.id && (
                    <span className="profile-theme-check" aria-hidden="true">
                      <Check size={16} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="profile-card card">
            <div className="profile-card-head">
              <User size={20} aria-hidden="true" />
              <div>
                <h2>Personal information</h2>
                <p>Update your name and phone number used for bookings.</p>
              </div>
            </div>

            <form className="profile-form" onSubmit={saveProfile}>
              <div className="profile-form-grid">
                <div className="field">
                  <label htmlFor="profile-name">Full name</label>
                  <div className="profile-input-wrap">
                    <User size={16} className="profile-input-icon" aria-hidden="true" />
                    <input
                      id="profile-name"
                      className="input"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="profile-email">Email address</label>
                  <div className="profile-input-wrap">
                    <Mail size={16} className="profile-input-icon" aria-hidden="true" />
                    <input
                      id="profile-email"
                      className="input profile-input-readonly"
                      value={user?.email || ''}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                </div>

                <div className="field profile-field-full">
                  <label htmlFor="profile-phone">Phone number</label>
                  <div className="profile-input-wrap">
                    <Phone size={16} className="profile-input-icon" aria-hidden="true" />
                    <input
                      id="profile-phone"
                      className="input"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="10-digit mobile"
                      required
                    />
                  </div>
                  {user?.placeholderPhone && (
                    <p className="muted" style={{ marginTop: 6 }}>
                      Google Sign-In does not share your mobile. Add your real number so Razorpay can show it at checkout.
                    </p>
                  )}
                </div>
              </div>

              {profileError && <div className="alert alert-error">{profileError}</div>}
              {profileMsg && <div className="alert alert-success">{profileMsg}</div>}

              <button type="submit" className="btn btn-primary" disabled={profileLoading}>
                <Save size={16} aria-hidden="true" />
                {profileLoading ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </section>

          <SavedPassengersPanel />

          <FavoriteRoutesPanel />
          <LoyaltyPanel />
          <GstSettingsPanel />
          <DeviceManagementPanel />
          <MfaSetupPanel />

          <section className="profile-card card">
            <div className="profile-card-head">
              <KeyRound size={20} aria-hidden="true" />
              <div>
                <h2>Change password</h2>
                <p>Use a strong password with at least 6 characters.</p>
              </div>
            </div>

            <form className="profile-form" onSubmit={changePassword}>
              <div className="profile-form-grid">
                <div className="field profile-field-full">
                  <label htmlFor="current-password">Current password</label>
                  <div className="profile-input-wrap">
                    <KeyRound size={16} className="profile-input-icon" aria-hidden="true" />
                    <input
                      id="current-password"
                      type={showCurrent ? 'text' : 'password'}
                      className="input"
                      value={passwords.currentPassword}
                      onChange={setPasswordField('currentPassword')}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="profile-toggle-password"
                      onClick={() => setShowCurrent(!showCurrent)}
                      aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    >
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="new-password">New password</label>
                  <div className="profile-input-wrap">
                    <KeyRound size={16} className="profile-input-icon" aria-hidden="true" />
                    <input
                      id="new-password"
                      type={showNew ? 'text' : 'password'}
                      className="input"
                      value={passwords.newPassword}
                      onChange={setPasswordField('newPassword')}
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="profile-toggle-password"
                      onClick={() => setShowNew(!showNew)}
                      aria-label={showNew ? 'Hide password' : 'Show password'}
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <div className="profile-input-wrap">
                    <KeyRound size={16} className="profile-input-icon" aria-hidden="true" />
                    <input
                      id="confirm-password"
                      type={showNew ? 'text' : 'password'}
                      className="input"
                      value={passwords.confirmPassword}
                      onChange={setPasswordField('confirmPassword')}
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
              </div>

              {passwordError && <div className="alert alert-error">{passwordError}</div>}
              {passwordMsg && <div className="alert alert-success">{passwordMsg}</div>}

              <button type="submit" className="btn btn-primary" disabled={passwordLoading}>
                <KeyRound size={16} aria-hidden="true" />
                {passwordLoading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return <ProfileContent />;
}
