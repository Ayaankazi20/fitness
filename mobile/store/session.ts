import { create } from 'zustand';
import { api, loadTokens, setSessionExpiredHandler } from '../services/api';
import type { Me } from '../types/api';

interface SessionState {
  status: 'loading' | 'signedOut' | 'needsOnboarding' | 'ready'; me: Me | null; bootError: string | null;
  boot: () => Promise<void>; refreshMe: () => Promise<void>; signOut: () => Promise<void>;
}
export const useSession = create<SessionState>((set, get) => ({
  status: 'loading', me: null, bootError: null,
  async boot() {
    setSessionExpiredHandler(() => set({ status: 'signedOut', me: null }));
    const t = await loadTokens();
    if (!t) return set({ status: 'signedOut' });
    await get().refreshMe();
  },
  async refreshMe() {
    try { const me = await api.me(); set({ me, status: me.onboarded ? 'ready' : 'needsOnboarding', bootError: null }); }
    catch (e: any) { if (e?.code === 'NETWORK' || e?.code === 'TIMEOUT') set({ status: 'signedOut', bootError: e.message }); else set({ status: 'signedOut' }); }
  },
  async signOut() { try { await api.logout(); } finally { set({ status: 'signedOut', me: null }); } },
}));
