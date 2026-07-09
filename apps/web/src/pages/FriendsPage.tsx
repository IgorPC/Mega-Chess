import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useSocialStore } from '../store/social.store';
import { useAuthStore } from '../store/auth.store';
import { getGameSocket } from '../lib/socket';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

interface Friend {
  id: string;
  nickname: string;
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
  rating: number;
}

interface PendingRequest {
  id: string;
  requester: { id: string; nickname: string; avatarUrl?: string };
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  sender?: { id: string; nickname: string; avatarUrl?: string };
}

export function FriendsPage() {
  const { t } = useTranslation('friends');
  const { user } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const { onlineIds, unreadFromIds, clearUnreadFrom } = useSocialStore();
  const location = useLocation();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [addNickname, setAddNickname] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [activeChat, setActiveChat] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesError, setMessagesError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<Friend | null>(null);
  const didAutoOpen = useRef(false);

  activeChatRef.current = activeChat;

  const openFriendId = (location.state as { openFriendId?: string } | null)?.openFriendId ?? null;

  const openChat = useCallback(async (friend: Friend) => {
    setActiveChat(friend);
    setMessagesError('');
    clearUnreadFrom(friend.id);
    try {
      const msgs = await api.get<Message[]>(`/messages/${friend.id}`);
      setMessages(msgs);
    } catch {
      setMessagesError(t('messages_load_error'));
    }
  }, [clearUnreadFrom, t]);

  const loadFriends = useCallback(async () => {
    const [friendsData, pendingData] = await Promise.all([
      api.get<Friend[]>('/friends').catch(() => [] as Friend[]),
      api.get<PendingRequest[]>('/friends/requests').catch(() => [] as PendingRequest[]),
    ]);
    setFriends(friendsData);
    setPending(pendingData);
    if (openFriendId && !didAutoOpen.current) {
      const friend = friendsData.find(f => f.id === openFriendId);
      if (friend) {
        didAutoOpen.current = true;
        openChat(friend);
      }
    }
  }, [openFriendId, openChat]);

  useEffect(() => {
    loadFriends();

    const socket = getGameSocket();
    const onNewMessage = (msg: Message) => {
      const chat = activeChatRef.current;
      if (chat && (msg.senderId === chat.id || msg.receiverId === chat.id)) {
        setMessages(prev => [...prev, msg]);
      }
    };
    socket.on('new_message', onNewMessage);
    return () => { socket.off('new_message', onNewMessage); };
  }, [loadFriends]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    setAddLoading(true);
    try {
      await api.post('/friends/request', { nickname: addNickname });
      setAddSuccess(t('request_sent', { nickname: addNickname }));
      setAddNickname('');
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : t('request_error'));
    } finally {
      setAddLoading(false);
    }
  }, [addNickname, t]);

  const handleAccept = useCallback(async (id: string) => {
    try {
      await api.patch(`/friends/request/${id}/accept`);
      loadFriends();
    } catch {
      // Optimistically ignore — list will be stale but not critical
      loadFriends();
    }
  }, [loadFriends]);

  const handleDecline = useCallback(async (id: string) => {
    try {
      await api.patch(`/friends/request/${id}/decline`);
    } catch {
      // best-effort
    } finally {
      loadFriends();
    }
  }, [loadFriends]);

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !activeChat || sending) return;
    setSending(true);
    setSendError('');
    try {
      const msg = await api.post<Message>(`/messages/${activeChat.id}`, { content: trimmed });
      setMessages(prev => [...prev, msg]);
      setChatInput('');
    } catch {
      setSendError(t('send_message_error'));
    } finally {
      setSending(false);
    }
  }, [chatInput, activeChat, sending, t]);

  const friendsWithStatus = friends
    .map(f => ({ ...f, isOnline: onlineIds.includes(f.id) }))
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline));

  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <h3 style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>{t('add_friend')}</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input
            value={addNickname}
            onChange={e => setAddNickname(e.target.value)}
            placeholder={t('nickname_placeholder')}
            required
          />
          {addError && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{addError}</span>}
          {addSuccess && <span style={{ fontSize: 12, color: 'var(--color-success)' }}>{addSuccess}</span>}
          <Button type="submit" fullWidth size="sm" disabled={addLoading}>
            {addLoading ? t('sending') : t('send_request')}
          </Button>
        </form>
      </Card>

      {pending.length > 0 && (
        <Card>
          <h3 style={{ fontWeight: 600, marginBottom: 14, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('requests')} <Badge variant="danger">{pending.length}</Badge>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(p => (
              <PendingRow
                key={p.id}
                request={p}
                onAccept={() => handleAccept(p.id)}
                onDecline={() => handleDecline(p.id)}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 style={{ fontWeight: 600, marginBottom: 14, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          {t('friends')}
          <Badge variant="muted">{friends.length}</Badge>
          {friendsWithStatus.filter(f => f.isOnline).length > 0 && (
            <Badge variant="success">{t('online_count', { count: friendsWithStatus.filter(f => f.isOnline).length })}</Badge>
          )}
        </h3>
        {friends.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
            {t('no_friends')}
          </p>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            maxHeight: 292, overflowY: 'auto',
            paddingRight: 4,
          }}>
            {friendsWithStatus.map(f => {
              const hasUnread = unreadFromIds.includes(f.id);
              const isSelected = activeChat?.id === f.id;
              return (
                <button key={f.id} onClick={() => openChat(f)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)', width: '100%',
                  background: isSelected ? 'var(--color-primary-dim)' : 'transparent',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                  transition: 'all var(--transition)', textAlign: 'left',
                }}>
                  <Avatar src={f.avatarUrl} name={f.nickname} size={34} online={f.isOnline} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: hasUnread ? 700 : 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.nickname}
                    </div>
                    <div style={{ fontSize: 11, color: f.isOnline ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      {f.isOnline ? t('online') : t('offline')} · {f.rating} ELO
                    </div>
                  </div>
                  {hasUnread && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );

  const chatIsOnline = activeChat ? onlineIds.includes(activeChat.id) : false;

  const chatPanel = activeChat ? (
    <Card style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100vh - 200px)' : 500, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {isMobile && (
          <button onClick={() => setActiveChat(null)} style={{ color: 'var(--color-primary)', fontSize: 14, fontWeight: 600, marginRight: 4, background: 'transparent' }}>
            {t('back')}
          </button>
        )}
        <Avatar src={activeChat.avatarUrl} name={activeChat.nickname} size={36} online={chatIsOnline} />
        <div>
          <div style={{ fontWeight: 600 }}>{activeChat.nickname}</div>
          <div style={{ fontSize: 12, color: chatIsOnline ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            {chatIsOnline ? t('online') : t('offline')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messagesError ? (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-danger)', marginBottom: 8 }}>{messagesError}</p>
            <Button size="sm" variant="ghost" onClick={() => openChat(activeChat)}>{t('retry')}</Button>
          </div>
        ) : messages.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 20 }}>
            {t('no_messages')}
          </p>
        ) : messages.map(m => (
          <div key={m.id} style={{
            alignSelf: m.senderId === user?.id ? 'flex-end' : 'flex-start',
            maxWidth: '70%', padding: '8px 12px',
            background: m.senderId === user?.id ? 'var(--color-primary)' : 'var(--color-surface-2)',
            borderRadius: 'var(--radius-sm)', fontSize: 13,
          }}>
            {m.content}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {sendError && (
        <div style={{ padding: '6px 14px', background: 'rgba(177,86,83,0.1)', borderTop: '1px solid var(--color-danger)' }}>
          <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{sendError}</p>
        </div>
      )}

      <form onSubmit={sendMessage} style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
        <input
          value={chatInput}
          onChange={e => { setChatInput(e.target.value); setSendError(''); }}
          placeholder={t('message_placeholder')}
          maxLength={500}
          disabled={sending}
          style={{
            flex: 1, background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
            padding: '9px 14px', fontSize: 13,
            opacity: sending ? 0.6 : 1,
          }}
        />
        <Button type="submit" size="sm" disabled={sending || !chatInput.trim()}>
          {sending ? '...' : t('send')}
        </Button>
      </form>
    </Card>
  ) : (
    <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-muted)', fontSize: 14 }}>
      {t('select_friend')}
    </Card>
  );

  if (isMobile) {
    return (
      <div style={{ padding: '20px 16px' }}>
        {activeChat ? chatPanel : sidebar}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
      {sidebar}
      {chatPanel}
    </div>
  );
}

// ─── PendingRow — extracted to track accept/decline loading per item ──────────

function PendingRow({ request, onAccept, onDecline }: {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar src={request.requester.avatarUrl} name={request.requester.nickname} size={32} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{request.requester.nickname}</span>
      <Button
        size="sm"
        style={{ padding: '4px 10px' }}
        disabled={loading !== null}
        onClick={async () => { setLoading('accept'); await onAccept(); setLoading(null); }}
      >
        {loading === 'accept' ? '...' : '✓'}
      </Button>
      <Button
        size="sm" variant="ghost"
        style={{ padding: '4px 10px' }}
        disabled={loading !== null}
        onClick={async () => { setLoading('decline'); await onDecline(); setLoading(null); }}
      >
        {loading === 'decline' ? '...' : '✕'}
      </Button>
    </div>
  );
}
