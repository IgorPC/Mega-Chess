import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Challenge {
  challengerId: string;
  challengerNickname: string;
  challengerRating: number;
  receivedAt: number;
  expiresAt: number;
}

export interface OutgoingChallenge {
  friendId: string;
  status: 'pending' | 'rejected';
  sentAt: number;
  cooldownUntil: number;
}

export interface DuelInvite {
  notificationId: string;
  tournamentId: string;
  inviterId: string;
  inviterNickname: string;
  type: 'DUEL_FLASH' | 'DUEL_GIANT';
  entryFee: number;
  timeControl: string;
  expiresAt: string;
  receivedAt: number;
}

interface SocialState {
  challenges: Challenge[];
  duelInvites: DuelInvite[];
  onlineIds: string[];
  unreadFromIds: string[];
  outgoingChallenges: Record<string, OutgoingChallenge>;

  addChallenge: (data: { challengerId: string; challengerNickname?: string; challengerRating: number; expiresIn?: number }) => void;
  removeChallenge: (challengerId: string) => void;
  addDuelInvite: (invite: Omit<DuelInvite, 'receivedAt'>) => void;
  removeDuelInvite: (tournamentId: string) => void;
  setOnlineFriends: (ids: string[]) => void;
  setFriendOnline: (userId: string, online: boolean) => void;
  addUnreadFrom: (senderId: string) => void;
  clearUnreadFrom: (senderId: string) => void;
  setPendingChallenge: (friendId: string) => void;
  setRejectedChallenge: (friendId: string) => void;
  clearOutgoingChallenge: (friendId: string) => void;
}

const COOLDOWN_MS = 30_000;

export const useSocialStore = create<SocialState>()(
  persist(
    (set) => ({
      challenges: [],
      duelInvites: [],
      onlineIds: [],
      unreadFromIds: [],
      outgoingChallenges: {},

      addChallenge: (data) => {
        const expiresIn = data.expiresIn ?? 60;
        const now = Date.now();
        const expiresAt = now + expiresIn * 1000;
        set(s => ({
          challenges: [
            ...s.challenges.filter(c => c.challengerId !== data.challengerId),
            {
              challengerId: data.challengerId,
              challengerNickname: data.challengerNickname ?? data.challengerId,
              challengerRating: data.challengerRating,
              receivedAt: now,
              expiresAt,
            },
          ],
        }));
        setTimeout(() => {
          set(s => ({ challenges: s.challenges.filter(c => c.challengerId !== data.challengerId) }));
        }, expiresIn * 1000);
      },

      removeChallenge: (challengerId) =>
        set(s => ({ challenges: s.challenges.filter(c => c.challengerId !== challengerId) })),

      addDuelInvite: (invite) => {
        const full: DuelInvite = { ...invite, receivedAt: Date.now() };
        set(s => ({
          duelInvites: [
            ...s.duelInvites.filter(d => d.tournamentId !== invite.tournamentId),
            full,
          ],
        }));
        const ttl = new Date(invite.expiresAt).getTime() - Date.now();
        if (ttl > 0) {
          setTimeout(() => {
            set(s => ({ duelInvites: s.duelInvites.filter(d => d.tournamentId !== invite.tournamentId) }));
          }, ttl);
        }
      },

      removeDuelInvite: (tournamentId) =>
        set(s => ({ duelInvites: s.duelInvites.filter(d => d.tournamentId !== tournamentId) })),

      setOnlineFriends: (ids) => set({ onlineIds: ids }),

      setFriendOnline: (userId, online) =>
        set(s => ({
          onlineIds: online
            ? s.onlineIds.includes(userId) ? s.onlineIds : [...s.onlineIds, userId]
            : s.onlineIds.filter(id => id !== userId),
        })),

      addUnreadFrom: (senderId) =>
        set(s => ({
          unreadFromIds: s.unreadFromIds.includes(senderId)
            ? s.unreadFromIds
            : [...s.unreadFromIds, senderId],
        })),

      clearUnreadFrom: (senderId) =>
        set(s => ({ unreadFromIds: s.unreadFromIds.filter(id => id !== senderId) })),

      setPendingChallenge: (friendId) =>
        set(s => ({
          outgoingChallenges: {
            ...s.outgoingChallenges,
            [friendId]: { friendId, status: 'pending', sentAt: Date.now(), cooldownUntil: 0 },
          },
        })),

      setRejectedChallenge: (friendId) => {
        const cooldownUntil = Date.now() + COOLDOWN_MS;
        set(s => ({
          outgoingChallenges: {
            ...s.outgoingChallenges,
            [friendId]: { friendId, status: 'rejected', sentAt: s.outgoingChallenges[friendId]?.sentAt ?? Date.now(), cooldownUntil },
          },
        }));
        setTimeout(() => {
          set(s => {
            const copy = { ...s.outgoingChallenges };
            delete copy[friendId];
            return { outgoingChallenges: copy };
          });
        }, COOLDOWN_MS);
      },

      clearOutgoingChallenge: (friendId) =>
        set(s => {
          const copy = { ...s.outgoingChallenges };
          delete copy[friendId];
          return { outgoingChallenges: copy };
        }),
    }),
    {
      name: 'megachess-social',
      // Só persiste challenges — onlineIds e unreadFromIds são reconstruídos via WS
      partialize: (state) => ({ challenges: state.challenges }),
      // Na rehidratação, descarta desafios já expirados e agenda auto-expiração dos restantes
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const now = Date.now();
        const alive = state.challenges.filter(c => c.expiresAt > now);
        state.challenges = alive;
        // Reagenda timeout de expiração para os desafios ainda válidos
        for (const c of alive) {
          const remaining = c.expiresAt - now;
          setTimeout(() => {
            useSocialStore.setState(s => ({
              challenges: s.challenges.filter(ch => ch.challengerId !== c.challengerId),
            }));
          }, remaining);
        }
      },
    },
  ),
);
