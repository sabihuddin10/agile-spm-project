'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/types';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { ROLE_META } from '@/components/staff/role-meta';

function CopyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast('Could not copy automatically — select the text and copy it manually.', 'error');
    }
  }

  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className={`input flex-1 bg-stone-50 ${mono ? 'font-mono tracking-wide sm:text-base' : ''}`}
        />
        <button type="button" onClick={copy} className="btn-secondary shrink-0" aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/**
 * Shown once with an account's email and temporary password, with
 * copy-to-clipboard buttons: after approving an application (US9.1) or after a
 * manager/admin resets someone's password.
 */
export function CredentialsModal({
  user,
  tempPassword,
  onClose,
  variant = 'created',
}: {
  user: User;
  tempPassword: string;
  onClose: () => void;
  variant?: 'created' | 'reset';
}) {
  const firstName = user.name.split(' ')[0];
  const roleBadge = <Badge tone={ROLE_META[user.role].tone}>{ROLE_META[user.role].label}</Badge>;
  return (
    <Modal title={variant === 'reset' ? 'Password reset' : 'Staff account created'} onClose={onClose}>
      <div className="space-y-3 sm:space-y-4">
        {variant === 'reset' ? (
          <p className="text-sm text-stone-600">
            <span className="font-medium text-stone-800">{user.name}</span> has been signed out everywhere. They can
            sign in as {roleBadge} with these details.
          </p>
        ) : (
          <p className="text-sm text-stone-600">
            <span className="font-medium text-stone-800">{user.name}</span> can now sign in as {roleBadge} with these
            details.
          </p>
        )}
        <CopyField label="Email" value={user.email} />
        <CopyField label="Temporary password" value={tempPassword} mono />
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="note">
          This password is shown only once. Copy it now and share it with {firstName} privately. They&apos;ll be asked
          to set their own password after signing in.
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            I&apos;ve saved it
          </button>
        </div>
      </div>
    </Modal>
  );
}
