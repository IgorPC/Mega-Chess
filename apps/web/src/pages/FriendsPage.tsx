import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../store/auth.store';
import { getGameSocket } from '../lib/socket';

export function FriendsPage() {
  const { user } = useAuthStore();
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [addNickname, setAddNickname] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    loadFriends();
    const socket = getGameSocket();
    socket.emit('join_social');
    socket.on('user_online', ({ userId }: any) =>
      setFriends(f => f.map(fr => fr.id === userId ? { ...fr, isOnline: true } : fr))
    );
    socket.on('user_offline', ({ userId }: any) =>
      setFriends(f => f.map(fr => fr.id === userId ? { ...fr, isOnline: false } : fr))
    );
    return () => { socket.off('user_online'); socket.off('user_offline'); };
  }, []);

  const loadFriends = () => {
    api.get<any[]>('/friends').then(setFriends).catch(() => {});
    api.get<any[]>('/friends/requests').then(setPending).catch(() => {});
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(''); setAddSuccess('');
    try {
      await api.post('/friends/request', { nickname: addNickname });
      setAddSuccess(`Solicitação enviada para @${addNickname}`);
      setAddNickname('');
    } catch (err: any) { setAddError(err.message); }
  };

  const handleAccept = async (id: string) => {
    await api.patch(`/friends/request/${id}/accept`);
    loadFriends();
  };

  const handleDecline = async (id: string) => {
    await api.patch(`/friends/request/${id}/decline`);
    loadFriends();
  };

  const openChat = async (friend: any) => {
    setActiveChat(friend);
    const msgs = await api.get<any[]>(`/messages/${friend.id}`);
    setMessages(msgs);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChat) return;
    const msg = await api.post<any>(`/messages/${activeChat.id}`, { content: chatInput.trim() });
    setMessages(m => [...m, msg]);
    setChatInput('');
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
      {/* Left */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Add friend */}
        <Card>
          <h3 style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>Adicionar amigo</h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input value={addNickname} onChange={e => setAddNickname(e.target.value)} placeholder="@apelido" required />
            {addError && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{addError}</span>}
            {addSuccess && <span style={{ fontSize: 12, color: 'var(--color-success)' }}>{addSuccess}</span>}
            <Button type="submit" fullWidth size="sm">Enviar solicitação</Button>
          </form>
        </Card>

        {/* Pending */}
        {pending.length > 0 && (
          <Card>
            <h3 style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>
              Solicitações <Badge variant="danger">{pending.length}</Badge>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar src={p.requester.avatarUrl} name={p.requester.nickname} size={32} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.requester.nickname}</span>
                  <Button size="sm" style={{ padding: '4px 8px' }} onClick={() => handleAccept(p.id)}>✓</Button>
                  <Button size="sm" variant="ghost" style={{ padding: '4px 8px' }} onClick={() => handleDecline(p.id)}>✕</Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Friends list */}
        <Card>
          <h3 style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>
            Amigos <Badge variant="muted">{friends.length}</Badge>
          </h3>
          {friends.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>Nenhum amigo ainda</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {friends.map(f => (
                <button key={f.id} onClick={() => openChat(f)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)', width: '100%',
                  background: activeChat?.id === f.id ? 'var(--color-primary-dim)' : 'transparent',
                  border: activeChat?.id === f.id ? '1px solid var(--color-primary)' : '1px solid transparent',
                  transition: 'all var(--transition)', textAlign: 'left',
                }}>
                  <Avatar src={f.avatarUrl} name={f.nickname} size={34} online={f.isOnline} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{f.nickname}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {f.isOnline ? 'Online' : 'Offline'} · {f.rating} ELO
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Right - Chat */}
      {activeChat ? (
        <Card style={{ display: 'flex', flexDirection: 'column', height: 500, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar src={activeChat.avatarUrl} name={activeChat.nickname} size={36} online={activeChat.isOnline} />
            <div>
              <div style={{ fontWeight: 600 }}>{activeChat.nickname}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{activeChat.isOnline ? 'Online' : 'Offline'}</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map(m => (
              <div key={m.id} style={{
                alignSelf: m.senderId === user?.id ? 'flex-end' : 'flex-start',
                maxWidth: '70%', padding: '8px 12px',
                background: m.senderId === user?.id ? 'var(--color-primary)' : 'var(--color-surface-2)',
                borderRadius: 'var(--radius-sm)', fontSize: 13,
              }}>
                {m.content}
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Mensagem..." style={{
              flex: 1, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', padding: '9px 14px', fontSize: 13, outline: 'none',
            }} />
            <Button type="submit" size="sm">Enviar</Button>
          </form>
        </Card>
      ) : (
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-muted)', fontSize: 14 }}>
          Selecione um amigo para conversar
        </Card>
      )}
    </div>
  );
}
