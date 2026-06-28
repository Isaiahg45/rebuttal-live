'use client'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useNotifications } from '../hooks/useNotifications'

const PRESENCE_SERVER_URL = 'https://rebuttal-live-production-3388.up.railway.app'

interface NavProps { active: string }

export default function Nav({ active }: NavProps) {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const initials = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '?'

const avatarUrl = profile?.avatar_url ?? null
  const [showNotifs, setShowNotifs] = useState(false)
  const { notifications, markSeen, markAllSeen } = useNotifications(profile?.username ?? '')
  const pendingBuddyCount = notifications.length

  // Online presence — this is the only signal the server gets that a user
  // is "on the site" at all (debate/admin pages open their own separate
  // sockets for room logic). One tiny socket, alive for as long as any page
  // with Nav mounted is open, reconnecting and re-announcing automatically.
  const presenceSocketRef = useRef<Socket | null>(null)
  useEffect(() => {
    const username = profile?.username
    if (!username) return
    const socket = io(PRESENCE_SERVER_URL, { transports: ['websocket', 'polling'] })
    presenceSocketRef.current = socket
    const announce = () => socket.emit('presence_identify', { username })
    socket.on('connect', announce)
    socket.io.on('reconnect', announce)
    return () => {
      socket.disconnect()
      presenceSocketRef.current = null
    }
  }, [profile?.username])

  // Cosmetic only — the real admin check lives server-side. Gated by email
  // rather than username since usernames can be changed but auth email can't.
  const ADMIN_EMAILS_UI = ['lg@isaiahlive.com', 'zachariussong@gmail.com']
  const isAdminUser = !!user?.email && ADMIN_EMAILS_UI.includes(user.email.toLowerCase())

  const tabs = [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'rebut', label: 'Rebut', href: '/rebut' },
    ...(isAdminUser ? [{ id: 'admin', label: 'Admin', href: '/admin' }] : []),
    { id: 'topic', label: '🔥 Debate of the Day', href: '/topic', special: true },
    { id: 'rankings', label: 'Rankings', href: '/rankings' },
    { id: 'shop', label: 'Shop', href: '/shop' },
    { id: 'help', label: 'Help', href: '/help' },
  ]

  return (
    <>
      <nav className="nav-root">
        {/* Logo */}
        <Link href="/" style={{ marginRight: 'auto', display: 'flex', alignItems: 'baseline', gap: 0, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '3px', color: 'var(--accent)', textShadow: '0 0 20px rgba(230,57,70,0.5)' }}>REBUTTAL</span>
          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '3px', color: 'var(--text)' }}>.LIVE</span>
        </Link>

        {/* Desktop tabs */}
        <div className="nav-tabs" style={{ marginLeft: '8px' }}>
          {tabs.map(tab => tab.special ? (
            <Link key={tab.id} href={tab.href} style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '6px',
              color: '#fff',
              background: 'linear-gradient(90deg, #e63946, #ff6b35)',
              border: 'none',
              animation: 'navPulse 2s ease-in-out infinite',
              whiteSpace: 'nowrap',
              display: 'inline-block',
            }}>{tab.label}</Link>
          ) : (
            <Link key={tab.id} href={tab.href} style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '6px',
              color: active === tab.id ? 'var(--text)' : 'var(--muted)',
              background: active === tab.id ? 'var(--surface2)' : 'transparent',
              border: active === tab.id ? '1px solid var(--border2)' : '1px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              display: 'inline-block',
            }}>{tab.label}</Link>
          ))}
        </div>

        {/* Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
          {loading ? (
            <div style={{ width: '80px', height: '28px', background: 'var(--surface2)', borderRadius: '20px', opacity: 0.3, animation: 'pulse 1.5s infinite' }} />
          ) : user ? (
            <>
             <div className="nav-elo-pill">
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px rgba(230,57,70,0.8)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{profile?.elo ?? 0}</span>
                <span className="elo-label" style={{ fontSize: '11px', color: 'var(--muted)' }}>ELO</span>
              </div>
              {/* TODO: replace hardcoded 0 with profile.coins when 1.3 launches */}
              <div className="nav-coin-pill">
                <img src="/rebut-coin.png" alt="RC" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>0</span>
              </div>

             {/* Notification bell */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => setShowNotifs(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', position: 'relative', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                  🔔
                  {pendingBuddyCount > 0 && (
                    <div style={{ position: 'absolute', top: '0px', right: '0px', width: '15px', height: '15px', borderRadius: '50%', background: '#e63946', fontSize: '9px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0a0a0a' }}>
                      {pendingBuddyCount}
                    </div>
                  )}
                </button>
                {showNotifs && (
                  <>
                    <div onClick={() => setShowNotifs(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                    <div style={{ position: 'absolute', top: '38px', right: 0, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', minWidth: '300px', maxWidth: '340px', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: 'rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>NOTIFICATIONS</span>
                        {notifications.length > 0 && (
                          <button onClick={markAllSeen} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Clear all</button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '24px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔕</div>
                          No new notifications
                        </div>
                      ) : (
                        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                          {notifications.map(n => {
                            const isAdminMsg = n.type === 'admin_warning'
                            return (
                              <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', background: isAdminMsg ? 'rgba(255,214,10,0.05)' : 'rgba(255,255,255,0.02)' }}>
                                <div style={{ flex: 1 }}>
                                  {isAdminMsg ? (
                                    <>
                                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffd60a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        📨 Rebuttal Live sent you a message
                                      </div>
                                      <button
                                        onClick={() => { setShowNotifs(false); router.push('/profile') }}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'underline', padding: 0, marginTop: '4px' }}
                                      >
                                        View in profile →
                                      </button>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>{n.message}</div>
                                  )}
                                </div>
                                <button onClick={() => markSeen(n.id)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>✕</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Avatar */}
              <div
                onClick={() => { router.push('/profile'); setMenuOpen(false) }}
                title={profile?.username ?? 'Profile'}
                style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(230,57,70,0.5)', boxShadow: '0 0 10px rgba(230,57,70,0.25)', cursor: 'pointer', flexShrink: 0, transition: 'box-shadow 0.2s' }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff' }}>{initials}</div>
                )}
              </div>

              <button
                onClick={handleSignOut}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}
              >Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" style={{ padding: '7px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '8px', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                Log in
              </Link>
              <Link href="/signup" style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: '8px', whiteSpace: 'nowrap', boxShadow: '0 0 12px rgba(230,57,70,0.4)', transition: 'all 0.2s' }}>
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button className="nav-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile dropdown */}
      <div className={`nav-mobile-menu${menuOpen ? ' open' : ''}`}>
        {tabs.map(tab => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`nav-mobile-link${active === tab.id ? ' active' : ''}${tab.special ? ' topic-link' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {tab.label}
          </Link>
        ))}

        {/* Mobile auth section */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '12px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(230,57,70,0.4)', flexShrink: 0 }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                      {initials}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{profile?.username}</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>{profile?.elo ?? 0} ELO</span>
                    {/* TODO: replace hardcoded 0 with profile.coins when 1.3 launches */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>
                      <img src="/rebut-coin.png" alt="" style={{ width: '12px', height: '12px', objectFit: 'contain' }} />0
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Sign out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', padding: '4px 8px' }}>
              <Link href="/login" onClick={() => setMenuOpen(false)} style={{ flex: 1, padding: '10px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', fontSize: '13px', fontWeight: 500 }}>Log in</Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)} style={{ flex: 1, padding: '10px', textAlign: 'center', background: 'var(--accent)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 700 }}>Sign up</Link>
            </div>
          )}
        </div>
      </div>

      {/* Overlay to close menu */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, top: '56px', zIndex: 98, background: 'transparent' }} />
      )}
    </>
  )
}