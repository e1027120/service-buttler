import { type FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/utils';
import { Button, Field, Input, Modal, useToast } from './ui';

export function AccountPasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const hasPassword = Boolean(user?.has_password);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast('New password must be at least 6 characters long', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match', 'error');
      return;
    }

    setBusy(true);
    try {
      await api.auth.updatePassword({
        current_password: hasPassword ? currentPassword : undefined,
        new_password: newPassword,
      });
      await refreshUser();
      toast(
        hasPassword
          ? 'Password updated successfully'
          : 'Password set! You can now sign in with your email and password.'
      );
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={hasPassword ? 'Change password' : 'Set a password'}
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {hasPassword
            ? `Update the password for ${user?.email}.`
            : `No password is set yet for ${user?.email}. Set one now so you can sign in with your email and password anytime.`}
        </p>

        {hasPassword && (
          <Field label="Current password">
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
            />
          </Field>
        )}

        <Field label="New password" hint="Minimum 6 characters">
          <Input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <Field label="Confirm new password">
          <Input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {hasPassword ? 'Update password' : 'Set password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
