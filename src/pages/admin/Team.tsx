import { Trash2, UserPlus } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, ConfirmButton, Field, Input, Modal, PageLoader, Select, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { supabase, unwrap } from '../../lib/supabase';
import type { Invitation, Member, MemberRole } from '../../lib/types';
import { errorMessage, formatInZone } from '../../lib/utils';
import { PageHeader } from './AdminLayout';
import { useAdmin } from './context';

export default function Team() {
  const { church, role: myRole, canAdmin } = useAdmin();
  const { user } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    const [mRes, iRes] = await Promise.all([
      supabase.rpc('list_members', { p_church: church.id }),
      supabase.from('church_invitations').select('*').eq('church_id', church.id).order('created_at'),
    ]);
    if (mRes.error) throw mRes.error;
    setMembers(mRes.data as Member[]);
    setInvitations((iRes.data as Invitation[]) || []);
  }, [church.id]);

  useEffect(() => {
    load().catch((e) => toast(errorMessage(e), 'error'));
  }, [load, toast]);

  const removeMember = async (m: Member) => {
    try {
      unwrap(await supabase.from('church_members').delete().eq('church_id', church.id).eq('user_id', m.user_id));
      toast('Member removed');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const updateRole = async (m: Member, newRole: MemberRole) => {
    try {
      unwrap(await supabase.from('church_members').update({ role: newRole }).eq('church_id', church.id).eq('user_id', m.user_id));
      toast('Role updated');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const cancelInvite = async (inv: Invitation) => {
    try {
      unwrap(await supabase.from('church_invitations').delete().eq('id', inv.id));
      toast('Invitation cancelled');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (!members) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Team members"
        description="Invite pastors, AV tech and service leaders to manage this church."
        actions={
          canAdmin && (
            <Button onClick={() => setInviting(true)}>
              <UserPlus className="h-4 w-4" /> Invite member
            </Button>
          )
        }
      />

      <section className="card mb-6">
        <header className="border-b border-slate-100 px-5 py-3 font-semibold">Active members</header>
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const isMe = m.user_id === user?.id;
            const canEditThisMember = canAdmin && (myRole === 'owner' || m.role !== 'owner');
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{m.full_name || m.email || 'Unnamed'}</span>
                    {isMe && <Badge tone="brand">You</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">{m.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  {canEditThisMember && !isMe ? (
                    <Select value={m.role} onChange={(e) => updateRole(m, e.target.value as MemberRole)} className="w-auto text-xs">
                      {myRole === 'owner' && <option value="owner">Owner</option>}
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                    </Select>
                  ) : (
                    <Badge tone={m.role === 'owner' ? 'brand' : 'slate'}>{m.role}</Badge>
                  )}
                  {canEditThisMember && !isMe && (
                    <ConfirmButton variant="ghost" size="sm" message={`Remove ${m.email} from ${church.name}?`} onConfirm={() => removeMember(m)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </ConfirmButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {invitations.length > 0 && (
        <section className="card">
          <header className="border-b border-slate-100 px-5 py-3 font-semibold">Pending invitations</header>
          <ul className="divide-y divide-slate-100">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium text-slate-800">{i.email}</div>
                  <div className="text-xs text-slate-500">
                    Invited {formatInZone(i.created_at, church.timezone, { dateStyle: 'medium' })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{i.role}</Badge>
                  {canAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => cancelInvite(i)}>
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inviting && (
        <InviteModal
          churchId={church.id}
          isOwner={myRole === 'owner'}
          onClose={() => setInviting(false)}
          onInvited={() => {
            setInviting(false);
            load();
          }}
        />
      )}
    </>
  );
}

function InviteModal({ churchId, isOwner, onClose, onInvited }: { churchId: string; isOwner: boolean; onClose: () => void; onInvited: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('editor');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('invite_member', {
        p_church: churchId,
        p_email: email.trim().toLowerCase(),
        p_role: role,
      });
      if (error) throw error;
      toast(data === 'added' ? 'User added to team' : 'Invitation recorded');
      onInvited();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Invite team member">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address" hint="If they already have an account, they get access immediately. Otherwise they gain access as soon as they sign up.">
          <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pastor@church.org" />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
            <option value="editor">Editor — can edit services and actions</option>
            <option value="admin">Admin — can also manage branding and team</option>
            {isOwner && <option value="owner">Owner — full access including deleting the church</option>}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Send invite</Button>
        </div>
      </form>
    </Modal>
  );
}
