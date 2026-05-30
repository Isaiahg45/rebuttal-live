'use client'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

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
  const [pendingBuddyCount, setPendingBuddyCount] = useState(0)

  useEffect(() => {
    if (!profile?.username) return
    supabase.from('buddies')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_username', profile.username)
      .eq('status', 'pending')
      .then(({ count }) => setPendingBuddyCount(count ?? 0))
  }, [profile?.username])
  const tabs = [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'rebut', label: 'Rebut', href: '/rebut' },
    { id: 'topic', label: '🔥 Debate of the Day', href: '/topic', special: true },
    { id: 'rankings', label: 'Rankings', href: '/rankings' },
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

              {/* Avatar — shows profile pic if available, else initials */}
              <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => { router.push('/profile'); setMenuOpen(false) }}>
                {pendingBuddyCount > 0 && (
                  <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', background: '#e63946', fontSize: '9px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, border: '2px solid var(--bg)' }}>
                    {pendingBuddyCount}
                  </div>
                )}
              <div
                onClick={() => { router.push('/profile'); setMenuOpen(false) }}
                title={profile?.username ?? 'Profile'}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid rgba(230,57,70,0.5)',
                  boxShadow: '0 0 10px rgba(230,57,70,0.25)',
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'box-shadow 0.2s',
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={initials}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: 'linear-gradient(135deg,var(--accent),#ff8c69)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: '#fff',
                  }}>{initials}</div>
                )}
             </div>
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
                  <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>{profile?.elo ?? 0} ELO</div>
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