import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { TERMS_VERSION } from './lib/terms';
import { useSocialStore } from './store/social.store';
import { useGameStore } from './store/game.store';
import { getGameSocket } from './lib/socket';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { FriendsPage } from './pages/FriendsPage';
import { RankingPage } from './pages/RankingPage';
import { HistoryPage } from './pages/HistoryPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OfflineSetupPage } from './pages/OfflineSetupPage';
import { OfflineGamePage } from './pages/OfflineGamePage';
import { WalletPage } from './pages/WalletPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentLobbyPage } from './pages/TournamentLobbyPage';
import { SupportPage } from './pages/SupportPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DuelInvitePopup } from './components/ui/DuelInvitePopup';
import { SuggestionsPage } from './pages/SuggestionsPage';
import { TermsPage } from './pages/TermsPage';

function needsTermsAcceptance(user: { termsAcceptedAt?: string | null; termsVersion?: string | null } | null) {
  if (!user) return false;
  return !user.termsAcceptedAt || user.termsVersion !== TERMS_VERSION;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
      ♚
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (needsTermsAcceptance(user) && location.pathname !== '/terms') return <Navigate to="/terms" replace />;
  return <>{children}</>;
}

function TermsRoute() {
  const { user, loading } = useAuthStore();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!needsTermsAcceptance(user)) return <Navigate to="/lobby" replace />;
  return <TermsPage />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return null;
  if (!user) return <>{children}</>;
  return <Navigate to={needsTermsAcceptance(user) ? '/terms' : '/lobby'} replace />;
}

/** Sets up global socket listeners once the user is authenticated. */
function playMatchStartSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, ctx.currentTime);        // C5
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12); // E5
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.24); // G5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch { /* AudioContext not available */ }
}

function SocialSocketManager() {
  const userId = useAuthStore(state => state.user?.id);
  const { addChallenge, setOnlineFriends, setFriendOnline, addUnreadFrom, setRejectedChallenge, addDuelInvite } = useSocialStore();
  const { setMatch } = useGameStore();
  const logout = useAuthStore(state => state.logout);
  const logoutLocal = useAuthStore(state => state.logoutLocal);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;

    const socket = getGameSocket();

    const setup = () => { socket.emit('join_social'); };
    setup();
    socket.on('connect', setup);

    const onFriendsStatus = ({ onlineIds }: { onlineIds: string[] }) => setOnlineFriends(onlineIds);
    const onUserOnline = ({ userId: uid }: { userId: string }) => setFriendOnline(uid, true);
    const onUserOffline = ({ userId: uid }: { userId: string }) => setFriendOnline(uid, false);
    const onChallenge = (data: { challengerId: string; challengerNickname?: string; challengerRating: number; expiresIn?: number }) => addChallenge(data);
    const onMessage = (msg: { senderId: string }) => addUnreadFrom(msg.senderId);
    const onRejected = (data: { challengedId: string }) => setRejectedChallenge(data.challengedId);
    const onDuelInvite = (data: any) => addDuelInvite(data);
    const onMatchFound = (data: {
      matchId: string;
      color?: 'white' | 'black';
      match?: { whitePlayer: { id: string; nickname: string; rating: number; avatarUrl?: string }; blackPlayer: { id: string; nickname: string; rating: number; avatarUrl?: string } };
    }) => {
      // Tournament match: includes color + player data → navigate from any page
      if (data?.color && data?.match) {
        playMatchStartSound();
        setMatch(data.matchId, data.color, data.match.whitePlayer, data.match.blackPlayer);
        navigate(`/game/${data.matchId}`);
      }
    };

    const onSessionInvalidated = ({ reason }: { reason?: string }) => {
      const msg = reason ?? 'Sua conta foi acessada em outro dispositivo';
      window.dispatchEvent(new CustomEvent('session:invalidated', { detail: msg }));
    };

    socket.on('friends_status', onFriendsStatus);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);
    socket.on('challenge_received', onChallenge);
    socket.on('new_message', onMessage);
    socket.on('challenge_rejected', onRejected);
    socket.on('duel_invite_received', onDuelInvite);
    socket.on('match_found', onMatchFound);
    socket.on('session_invalidated', onSessionInvalidated);

    return () => {
      socket.off('connect', setup);
      socket.off('friends_status', onFriendsStatus);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
      socket.off('challenge_received', onChallenge);
      socket.off('new_message', onMessage);
      socket.off('challenge_rejected', onRejected);
      socket.off('duel_invite_received', onDuelInvite);
      socket.off('match_found', onMatchFound);
      socket.off('session_invalidated', onSessionInvalidated);
      setOnlineFriends([]);
    };
  }, [userId, logout, logoutLocal]);

  return null;
}

export default function App() {
  const { fetchMe, logout } = useAuthStore();
  const [maintenance, setMaintenance] = useState<string | null>(null);
  const [banned, setBanned] = useState<string | null>(null);
  const [sessionKicked, setSessionKicked] = useState<string | null>(null);

  useEffect(() => { fetchMe(); }, []);

  useEffect(() => {
    const toSafeString = (detail: unknown): string =>
      typeof detail === 'string' ? detail.slice(0, 500) : '';
    const onMaintenance = (e: Event) => setMaintenance(toSafeString((e as CustomEvent).detail));
    const onBanned = (e: Event) => setBanned(toSafeString((e as CustomEvent).detail));
    const onSessionInvalidated = (e: Event) => setSessionKicked(toSafeString((e as CustomEvent).detail));
    const onLogout = () => { logout(); };
    window.addEventListener('platform:maintenance', onMaintenance);
    window.addEventListener('account:banned', onBanned);
    window.addEventListener('session:invalidated', onSessionInvalidated);
    window.addEventListener('auth:logout', onLogout);
    return () => {
      window.removeEventListener('platform:maintenance', onMaintenance);
      window.removeEventListener('account:banned', onBanned);
      window.removeEventListener('session:invalidated', onSessionInvalidated);
      window.removeEventListener('auth:logout', onLogout);
    };
  }, [logout]);

  if (maintenance !== null) return <MaintenancePage message={maintenance} />;

  if (sessionKicked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg)', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>📱</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: 'var(--color-danger)' }}>
          Sessão encerrada
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 400, lineHeight: 1.6 }}>
          {sessionKicked}
        </p>
        <button
          onClick={() => { setSessionKicked(null); logout(); }}
          style={{
            marginTop: 24, padding: '10px 24px', borderRadius: 8,
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          Fazer login novamente
        </button>
      </div>
    );
  }

  if (banned) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg)', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🚫</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: 'var(--color-danger)' }}>
          Conta suspensa
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 400, lineHeight: 1.6 }}>
          {banned}
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 16 }}>
          Em caso de dúvidas, abra um ticket em{' '}
          <a href="mailto:suporte@megachess.io" style={{ color: 'var(--color-primary)' }}>suporte@megachess.io</a>
        </p>
      </div>
    );
  }

  return (
    <>
      <SocialSocketManager />
      <DuelInvitePopup />
      <Routes>
        <Route element={<AppLayout />}>
          {/* Public */}
          <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected */}
          <Route path="/terms" element={<TermsRoute />} />
          <Route path="/lobby" element={<PrivateRoute><LobbyPage /></PrivateRoute>} />
          <Route path="/game/:matchId" element={<PrivateRoute><GamePage /></PrivateRoute>} />
          <Route path="/profile/me" element={<PrivateRoute><EditProfilePage /></PrivateRoute>} />
          <Route path="/profile/:nickname" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/friends" element={<PrivateRoute><FriendsPage /></PrivateRoute>} />
          <Route path="/ranking" element={<PrivateRoute><RankingPage /></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
          <Route path="/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
          <Route path="/tournaments" element={<PrivateRoute><TournamentsPage /></PrivateRoute>} />
          <Route path="/tournaments/:id" element={<Navigate to="/tournaments" replace />} />
          <Route path="/suggestions" element={<PrivateRoute><SuggestionsPage /></PrivateRoute>} />
          <Route path="/support" element={<PrivateRoute><SupportPage /></PrivateRoute>} />
          <Route path="/support/:ticketId" element={<PrivateRoute><TicketDetailPage /></PrivateRoute>} />
          <Route path="/play/offline" element={<PrivateRoute><OfflineSetupPage /></PrivateRoute>} />
          <Route path="/play/offline/game" element={<PrivateRoute><OfflineGamePage /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
