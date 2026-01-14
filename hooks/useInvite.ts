import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types';

type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired' | string;

export function useInvite() {
  const { organizationId, user, role: currentRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clear = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  /**
   * Admin-only: creates an invite row. The invite "token" is the invite id (uuid).
   * Email sending is not implemented here; copy link in UI for MVP.
   */
  const sendInvite = useCallback(
    async (email: string, role: Role) => {
      clear();
      if (currentRole !== 'admin') {
        setError('Apenas admins podem convidar.');
        return null;
      }
      if (!organizationId) {
        setError('Organization não carregada.');
        return null;
      }
      if (!email) {
        setError('Email é obrigatório.');
        return null;
      }

      setLoading(true);
      try {
        const inviteId = crypto.randomUUID();
        const { data, error: insErr } = await supabase
          .from('invites')
          .insert({
            id: inviteId,
            organization_id: organizationId,
            email,
            role,
            status: 'pending' as InviteStatus,
          })
          .select('id, organization_id, email, role, status')
          .single();

        if (insErr) throw insErr;
        setSuccess('Convite criado.');
        return data;
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao criar convite');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [organizationId, currentRole, clear]
  );

  /**
   * Accepts an invite and provisions public.users for the current auth user.
   * For MVP, invite id = token.
   */
  const acceptInvite = useCallback(
    async (inviteId: string) => {
      clear();
      if (!user?.id) {
        setError('Você precisa estar logado para aceitar o convite.');
        return false;
      }
      if (!inviteId) {
        setError('Convite inválido.');
        return false;
      }

      setLoading(true);
      try {
        // 1) Fetch invite
        const { data: invite, error: invErr } = await supabase
          .from('invites')
          .select('id, organization_id, email, role, status')
          .eq('id', inviteId)
          .single();

        if (invErr) throw invErr;
        if (!invite) throw new Error('Convite não encontrado.');

        const status = (invite as any).status as InviteStatus;
        if (status && status !== 'pending') {
          throw new Error(`Convite não está pendente (status: ${status}).`);
        }

        // 2) Basic email match check (optional, but helps UX).
        // If you allow invites to be accepted by any logged user, remove this.
        const authEmail = user.email?.toLowerCase() ?? '';
        const inviteEmail = String((invite as any).email ?? '').toLowerCase();
        if (inviteEmail && authEmail && inviteEmail !== authEmail) {
          throw new Error(
            'Este convite foi emitido para outro e-mail. Faça login com o e-mail correto.'
          );
        }

        // 3) Create row in public.users (provisioning)
        const { error: userInsErr } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            name: (user.user_metadata as any)?.full_name ?? null,
            organization_id: (invite as any).organization_id,
            role: (invite as any).role ?? 'viewer',
          });

        if (userInsErr) throw userInsErr;

        // 4) Mark invite as accepted
        const { error: updErr } = await supabase
          .from('invites')
          .update({ status: 'accepted' as InviteStatus })
          .eq('id', inviteId);

        if (updErr) throw updErr;

        setSuccess('Convite aceito. Acesso liberado!');
        return true;
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao aceitar convite');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, clear]
  );

  return { loading, error, success, sendInvite, acceptInvite, clear };
}
