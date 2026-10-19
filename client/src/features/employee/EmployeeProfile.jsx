import { useEffect, useState } from 'react';

import { employeeApi } from '../../api/resources.js';
import { useAuth } from '../../auth/useAuth.js';
import { Alert, Button, Card, Field, LoadingState, PageHeader } from '../../components/ui/index.jsx';
import { formatDate } from '../../lib/format.js';

export default function EmployeeProfile() {
  const { employee, updateEmployee } = useAuth();
  const [profile, setProfile] = useState(employee);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState({ saving: false, error: '', success: '' });
  const [passwords, setPasswords] = useState({
    oldPassword: '',
    newPassword: '',
    confirmation: '',
  });
  const [passwordStatus, setPasswordStatus] = useState({ saving: false, error: '', success: '' });

  useEffect(() => {
    employeeApi.getProfile(employee.employeeId)
      .then((data) => {
        setProfile(data);
        updateEmployee(data);
      })
      .catch((error) => setProfileStatus({ saving: false, error: error.message, success: '' }))
      .finally(() => setLoading(false));
  }, [employee.employeeId, updateEmployee]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileStatus({ saving: true, error: '', success: '' });
    try {
      const updated = await employeeApi.updateProfile(employee.employeeId, {
        email: profile.email?.trim() || '',
        address: profile.address?.trim() || '',
      });
      setProfile(updated);
      updateEmployee(updated);
      setProfileStatus({ saving: false, error: '', success: 'Profile changes saved.' });
    } catch (error) {
      setProfileStatus({ saving: false, error: error.message, success: '' });
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (passwords.newPassword.length < 8) {
      setPasswordStatus({ saving: false, error: 'Use at least 8 characters.', success: '' });
      return;
    }
    if (passwords.newPassword !== passwords.confirmation) {
      setPasswordStatus({ saving: false, error: 'New passwords do not match.', success: '' });
      return;
    }

    setPasswordStatus({ saving: true, error: '', success: '' });
    try {
      await employeeApi.changePassword(employee.employeeId, {
        oldPassword: passwords.oldPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ oldPassword: '', newPassword: '', confirmation: '' });
      setPasswordStatus({ saving: false, error: '', success: 'Password updated.' });
    } catch (error) {
      setPasswordStatus({ saving: false, error: error.message, success: '' });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        description="Keep your contact details current and protect your account."
        eyebrow="Account"
        title="Profile & security"
      />

      {loading ? <LoadingState label="Loading profile" /> : (
        <div className="content-grid content-grid--profile">
          <Card className="content-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Personal details</p>
                <h2>Your profile</h2>
                <p>Identity and role fields are managed by HR.</p>
              </div>
            </div>
            {profileStatus.error ? <Alert variant="danger">{profileStatus.error}</Alert> : null}
            {profileStatus.success ? <Alert variant="success">{profileStatus.success}</Alert> : null}
            <form className="form-grid" onSubmit={handleProfileSubmit}>
              <Field label="Full name" name="name">
                <input disabled id="name" value={profile.name || ''} />
              </Field>
              <Field label="Employee ID" name="employeeId">
                <input disabled id="employeeId" value={profile.employeeId || ''} />
              </Field>
              <Field label="Job title" name="title">
                <input disabled id="title" value={profile.title || ''} />
              </Field>
              <Field label="Start date" name="startDate">
                <input disabled id="startDate" value={formatDate(profile.startDate)} />
              </Field>
              <Field label="Work email" name="email">
                <input
                  autoComplete="email"
                  id="email"
                  onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  value={profile.email || ''}
                />
              </Field>
              <Field label="Home address" name="address">
                <textarea
                  id="address"
                  onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
                  rows="3"
                  value={profile.address || ''}
                />
              </Field>
              <div className="form-actions form-grid__full">
                <Button loading={profileStatus.saving} type="submit">Save profile</Button>
              </div>
            </form>
          </Card>

          <Card className="content-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Security</p>
                <h2>Change password</h2>
                <p>Use a unique password with at least 8 characters.</p>
              </div>
            </div>
            {passwordStatus.error ? <Alert variant="danger">{passwordStatus.error}</Alert> : null}
            {passwordStatus.success ? <Alert variant="success">{passwordStatus.success}</Alert> : null}
            <form className="form-stack" onSubmit={handlePasswordSubmit}>
              <Field
                autoComplete="current-password"
                label="Current password"
                name="currentPassword"
                onChange={(event) => setPasswords((current) => ({
                  ...current,
                  oldPassword: event.target.value,
                }))}
                required
                type="password"
                value={passwords.oldPassword}
              />
              <Field
                autoComplete="new-password"
                label="New password"
                name="newPassword"
                onChange={(event) => setPasswords((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))}
                required
                type="password"
                value={passwords.newPassword}
              />
              <Field
                autoComplete="new-password"
                label="Confirm new password"
                name="confirmNewPassword"
                onChange={(event) => setPasswords((current) => ({
                  ...current,
                  confirmation: event.target.value,
                }))}
                required
                type="password"
                value={passwords.confirmation}
              />
              <div className="form-actions">
                <Button loading={passwordStatus.saving} type="submit">Update password</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
