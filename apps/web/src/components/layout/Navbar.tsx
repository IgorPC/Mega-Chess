import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useSocialStore } from '../../store/social.store';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useSound } from '../../hooks/useSound';
import { Avatar } from '../ui/Avatar';
import { api } from '../../lib/api';
import { getGameSocket } from '../../lib/socket';
import logoSvg from '../../assets/logo.svg';

const NAV_LINKS = [
  { to: '/lobby', label: 'Jogar' },
  { to: '/tournaments', label: 'Competições' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/friends', label: 'Amigos' },
  { to: '/history', label: 'Histórico' },
  { to: '/suggestions', label: 'Sugestões' },
  { to: '/support', label: 'Suporte' },
];

export function Navbar() {
  const { user, logout } = useAuthStore();
  const { challenges, unreadFromIds } = useSocialStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const { play } = useSound();
  const [notifications, setNotifications] = useState(0);
  const [ccBalance, setCcBalance] = useState<string | null>(null);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Total alert count: DB notifications + live challenges + unread DMs
  const alertCount = notifications + challenges.length + unreadFromIds.length;

  useEffect(() => {
    setDesktopMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    api.get<unknown[]>('/notifications')
      .then(n => setNotifications(n.length))
      .catch(() => {});
    api.get<{ balance: string }>('/wallet')
      .then(r => setCcBalance(parseFloat(r.balance).toFixed(0)))
      .catch(() => {});
  }, [user, location.pathname]);

  // Real-time: bump the bell + play a sound the instant a notification arrives,
  // instead of waiting for the next page navigation to re-fetch the count.
  useEffect(() => {
    if (!user) return;
    const socket = getGameSocket();
    const onNotificationCreated = () => {
      setNotifications(n => n + 1);
      play('notification');
    };
    socket.on('notification_created', onNotificationCreated);
    return () => { socket.off('notification_created', onNotificationCreated); };
  }, [user, play]);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = useCallback(async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/');
  }, [logout, navigate]);

  const goTo = useCallback((path: string) => {
    setDesktopMenuOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  }, [navigate]);

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 'var(--navbar-height)',
        background: 'rgba(12, 11, 19, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        gap: 8,
      }}>
        {/* Logo */}
        <Link
          to={user ? '/lobby' : '/'}
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: isMobile ? 'auto' : 32, flexShrink: 0 }}
        >
          <img src={logoSvg} alt="Mega Chess" style={{ width: 36, height: 36 }} />
          {!isMobile && (
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
              Mega Chess <span style={{ color: 'var(--color-primary)' }}>Online</span>
            </span>
          )}
        </Link>

        {/* Desktop: nav links */}
        {user && !isMobile && (
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: 14, fontWeight: 500,
                color: isActive(to) ? 'var(--color-text)' : 'var(--color-text-muted)',
                background: isActive(to) ? 'var(--color-surface-2)' : 'transparent',
                transition: 'all var(--transition)',
              }}>
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* Right side */}
        <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <>
              {!isMobile && (
                <>
                  {/* Notification bell */}
                  <button
                    onClick={() => navigate('/notifications')}
                    aria-label="Notificações"
                    style={{
                      position: 'relative', padding: 8,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <BellIcon />
                    {alertCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--color-danger)',
                        border: '1.5px solid var(--color-bg)',
                      }} />
                    )}
                  </button>

                  {/* CC balance badge */}
                  {ccBalance !== null && (
                    <button
                      onClick={() => navigate('/wallet')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '5px 12px',
                        fontSize: 13, fontWeight: 600,
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ color: 'var(--color-primary)' }}>◈</span>
                      {ccBalance} CC
                    </button>
                  )}

                  {/* ELO badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '5px 12px',
                    fontSize: 13, fontWeight: 600,
                  }}>
                    <span style={{ color: 'var(--color-primary)' }}>♛</span>
                    {user.rating}
                  </div>

                  {/* Desktop avatar dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setDesktopMenuOpen(o => !o)}
                      style={{ padding: 0, borderRadius: '50%' }}
                      aria-label="Menu do usuário"
                    >
                      <Avatar src={user.avatarUrl} name={user.nickname} size={36} />
                    </button>
                    {desktopMenuOpen && (
                      <div style={{
                        position: 'absolute', top: 48, right: 0, zIndex: 200,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        minWidth: 180,
                        boxShadow: 'var(--shadow-card)',
                        overflow: 'hidden',
                        animation: 'fadeIn 150ms ease forwards',
                      }}>
                        <DropdownItem onClick={() => goTo(`/profile/${user.nickname}`)}>Perfil</DropdownItem>
                        <DropdownItem onClick={() => goTo('/profile/me')}>Editar Perfil</DropdownItem>
                        <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                        <DropdownItem onClick={handleLogout} danger>Sair</DropdownItem>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Mobile: hamburger */}
              {isMobile && (
                <button
                  onClick={() => setMobileMenuOpen(o => !o)}
                  aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                  aria-expanded={mobileMenuOpen}
                  style={{
                    padding: 10,
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    background: mobileMenuOpen ? 'var(--color-surface-2)' : 'transparent',
                  }}
                >
                  <span style={{
                    display: 'block', width: 20, height: 2,
                    background: 'currentColor', borderRadius: 1,
                    transition: 'transform 200ms ease',
                    transform: mobileMenuOpen ? 'translateY(7px) rotate(45deg)' : 'none',
                  }} />
                  <span style={{
                    display: 'block', width: 20, height: 2,
                    background: 'currentColor', borderRadius: 1,
                    transition: 'opacity 200ms ease',
                    opacity: mobileMenuOpen ? 0 : 1,
                  }} />
                  <span style={{
                    display: 'block', width: 20, height: 2,
                    background: 'currentColor', borderRadius: 1,
                    transition: 'transform 200ms ease',
                    transform: mobileMenuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
                  }} />
                </button>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/" style={{
                padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)',
              }}>
                Entrar
              </Link>
              <Link to="/register" style={{
                padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: 14, fontWeight: 500, color: '#fff',
                background: 'var(--color-primary)',
              }}>
                Cadastrar
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && mobileMenuOpen && user && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, top: 'var(--navbar-height)',
              zIndex: 98, background: 'rgba(0,0,0,0.5)',
            }}
          />
          {/* Menu panel */}
          <div
            className="mobile-menu-enter"
            style={{
              position: 'fixed', top: 'var(--navbar-height)', left: 0, right: 0, zIndex: 99,
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
              paddingBottom: 8,
            }}
          >
            {/* User header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 20px',
              borderBottom: '1px solid var(--color-border)',
              marginBottom: 4,
            }}>
              <Avatar src={user.avatarUrl} name={user.nickname} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{user.nickname}</div>
                <div style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
                  ♛ {user.rating} ELO
                </div>
              </div>
              {alertCount > 0 && (
                <div style={{
                  background: 'var(--color-danger)', color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  minWidth: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, padding: '0 6px',
                }}>
                  {alertCount}
                </div>
              )}
            </div>

            {/* Notifications entry — mobile has no bell icon, so this is the only entry point */}
            <button onClick={() => goTo('/notifications')} style={{
              display: 'flex', width: '100%', alignItems: 'center', gap: 10,
              padding: '13px 20px', fontSize: 15, fontWeight: 500,
              color: isActive('/notifications') ? 'var(--color-primary)' : 'var(--color-text)',
              background: isActive('/notifications') ? 'var(--color-primary-dim)' : 'transparent',
              borderLeft: isActive('/notifications') ? '3px solid var(--color-primary)' : '3px solid transparent',
              textAlign: 'left',
            }}>
              <BellIcon />
              Notificações
              {notifications > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--color-danger)', color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  minWidth: 20, height: 20, padding: '0 5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                }}>
                  {notifications}
                </span>
              )}
            </button>

            <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />

            {/* Nav links */}
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} style={{
                display: 'flex', alignItems: 'center',
                padding: '13px 20px', fontSize: 15, fontWeight: 500,
                color: isActive(to) ? 'var(--color-primary)' : 'var(--color-text)',
                background: isActive(to) ? 'var(--color-primary-dim)' : 'transparent',
                borderLeft: isActive(to) ? '3px solid var(--color-primary)' : '3px solid transparent',
              }}>
                {label}
              </Link>
            ))}

            <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />

            <button onClick={() => goTo('/wallet')} style={{
              display: 'flex', width: '100%',
              padding: '13px 20px', fontSize: 15,
              color: 'var(--color-text)', textAlign: 'left', background: 'transparent',
              alignItems: 'center', gap: 10,
            }}>
              <span style={{ color: 'var(--color-primary)' }}>◈</span>
              Carteira{ccBalance !== null ? ` · ${ccBalance} CC` : ''}
            </button>

            <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 0' }} />

            <button onClick={() => goTo(`/profile/${user.nickname}`)} style={{
              display: 'flex', width: '100%',
              padding: '13px 20px', fontSize: 15,
              color: 'var(--color-text)', textAlign: 'left', background: 'transparent',
            }}>
              Meu Perfil
            </button>
            <button onClick={() => goTo('/profile/me')} style={{
              display: 'flex', width: '100%',
              padding: '13px 20px', fontSize: 15,
              color: 'var(--color-text)', textAlign: 'left', background: 'transparent',
            }}>
              Editar Perfil
            </button>
            <button onClick={handleLogout} style={{
              display: 'flex', width: '100%',
              padding: '13px 20px', fontSize: 15,
              color: 'var(--color-danger)', textAlign: 'left', background: 'transparent',
            }}>
              Sair
            </button>
          </div>
        </>
      )}
    </>
  );
}

function DropdownItem({ children, onClick, danger }: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '10px 16px', fontSize: 14,
        color: danger ? 'var(--color-danger)' : 'var(--color-text)',
        background: hover ? 'var(--color-surface-2)' : 'transparent',
        transition: 'background var(--transition)',
      }}
    >
      {children}
    </button>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
