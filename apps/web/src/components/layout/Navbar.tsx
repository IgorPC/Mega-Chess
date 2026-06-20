import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import { api } from '../../lib/api';
import logoSvg from '../../assets/logo.svg';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      api.get<any[]>('/notifications').then(n => setNotifications(n.length)).catch(() => {});
    }
  }, [user, location.pathname]);

  const navLinks = [
    { to: '/lobby', label: 'Jogar' },
    { to: '/ranking', label: 'Ranking' },
    { to: '/friends', label: 'Amigos' },
    { to: '/history', label: 'Histórico' },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 64,
      background: 'rgba(12, 11, 19, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
    }}>
      {/* Logo */}
      <Link to={user ? '/lobby' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 40 }}>
        <img src={logoSvg} alt="Mega Chess" style={{ width: 36, height: 36 }} />
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
          Mega Chess <span style={{ color: 'var(--color-primary)' }}>Online</span>
        </span>
      </Link>

      {/* Nav links */}
      {user && (
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {navLinks.map(({ to, label }) => (
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
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <>
            {/* Notification bell */}
            <button
              onClick={() => navigate('/notifications')}
              style={{ position: 'relative', padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
            >
              <BellIcon />
              {notifications > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--color-danger)',
                  border: '1.5px solid var(--color-bg)',
                }} />
              )}
            </button>

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

            {/* Avatar menu */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(o => !o)} style={{ padding: 0, borderRadius: '50%' }}>
                <Avatar src={user.avatarUrl} name={user.nickname} size={36} />
              </button>
              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 48, right: 0, zIndex: 200,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  minWidth: 180,
                  boxShadow: 'var(--shadow-card)',
                  overflow: 'hidden',
                }}>
                  <MenuItem onClick={() => { navigate(`/profile/${user.nickname}`); setMenuOpen(false); }}>Perfil</MenuItem>
                  <MenuItem onClick={() => { navigate('/profile/me'); setMenuOpen(false); }}>Editar Perfil</MenuItem>
                  <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                  <MenuItem onClick={handleLogout} danger>Sair</MenuItem>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/" style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)',
              fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)',
            }}>Entrar</Link>
            <Link to="/register" style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)',
              fontSize: 14, fontWeight: 500, color: '#fff',
              background: 'var(--color-primary)',
            }}>Cadastrar</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
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
