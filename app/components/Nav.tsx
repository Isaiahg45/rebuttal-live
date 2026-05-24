'use client'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

  const tabs = [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'rebut', label: 'Rebut', href: '/rebut' },
    { id: 'topic', label: '🔥 Debate of the Day', href: '/topic' },
    { id: 'rankings', label: 'Rankings', href: '/rankings' },
    { id: 'help', label: 'Help', href: '/help' },
  ]

  return (
    <>
      <style>{`
        .nav-root {
          background: rgba(8,8,8,0.97);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding: 0 24px;
          display: flex;
          align-items: center;
          height: 56px;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .nav-tabs { display: flex; gap: 4px; }
        .nav-hamburger { display: none; }
        .nav-mobile-menu {
          display: none;
          position: fixed;
          top: 56px;
          left: 0;
          right: 0;
          background: rgba(8,8,8,0.98);
          border-bottom: 1px solid var(--border);
          padding: 12px 16px;
          flex-direction: column;
          gap: 4px;
          z-index: 99;
          backdrop-filter: blur(20px);
        }
        .nav-mobile-menu.open { display: flex; }
        .nav-mobile-link {
          padding: 12px 16px;
          font-size: 15px;
          font-weight: 500;
          border-radius: 8px;
          color: var(--text2);
          text-decoration: none;
          display: block;
        }
        .nav-mobile-link.active {
          background: var(--surface2);
          color: var(--text);
          border: 1px solid var(--border);
        }
        .nav-mobile-link.topic-link {
          background: linear-gradient(90deg, #e63946, #ff6b35);
          color: #fff;
          font-weight: 700;
        }
        .nav-elo-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 4px 12px;
        }
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
        @keyframes navPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(230,57,70,0.7), 0 0 16px rgba(255,107,53,0.4); }
          50% { box-shadow: 0 0 18px rgba(230,57,70,1), 0 0 36px rgba(255,107,53,0.7), 0 0 54px rgba(230,57,70,0.3); }
        }
        @media (max-width: 768px) {
          .nav-root { padding: 0 16px; }
          .nav-tabs { display: none; }
          .nav-hamburger { display: flex; align-items: center; justify-content: center; background: none; border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; cursor: pointer; color: var(--text2); font-size: 18px; margin-left: 8px; }
          .nav-elo-pill { padding: 3px 8px; }
          .nav-elo-pill span:last-child { display: none; }
        }
      `}</style>

      <nav className="nav-root">
        <Link href="/" style={{ marginRight: 'auto', display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '3px', color: 'var(--accent)' }}>REBUTTAL</span>
          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '3px', color: 'var(--text)' }}>.LIVE</span>
        </Link>

        {/* Desktop tabs */}
        <div className="nav-tabs">
          {tabs.map(tab => tab.id === 'topic' ? (
            <Link key={tab.id} href={tab.href} style={{
              padding: '6px 16px', fontSize: '13px', fontWeight: 700, borderRadius: '6px',
              color: '#fff', background: 'linear-gradient(90deg, #e63946, #ff6b35)',
              border: 'none', animation: 'navPulse 2s ease-in-out infinite', whiteSpace: 'nowrap',
            }}>{tab.label}</Link>
          ) : (
            <Link key={tab.id} href={tab.href} style={{
              padding: '6px 16px', fontSize: '13px', fontWeight: 500, borderRadius: '6px',
              color: active === tab.id ? 'var(--text)' : 'var(--muted)',
              background: active === tab.id ? 'var(--surface2)' : 'transparent',
              border: active === tab.id ? '1px solid var(--border)' : '1px solid transparent',
              transition: 'all 0.2s',
            }}>{tab.label}</Link>
          ))}
        </div>

        {/* Auth section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
          {loading ? (
            <div style={{ width: '80px', height: '28px', background: 'var(--surface2)', borderRadius: '20px', opacity: 0.3, animation: 'pulse 1.5s infinite' }} />
          ) : user ? (
            <>
              <div className="nav-elo-pill">
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{profile?.elo ?? 0}</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>ELO</span>
              </div>
              <div
                onClick={() => { router.push('/profile'); setMenuOpen(false) }}
                title={profile?.username ?? 'Profile'}
                style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', border: '2px solid rgba(230,57,70,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: '#fff', flexShrink: 0 }}
              >{initials}</div>
              <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" style={{ padding: '7px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                Log in
              </Link>
              <Link href="/signup" style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: '8px', whiteSpace: 'nowrap' }}>
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

      {/* Mobile dropdown menu */}
      <div className={`nav-mobile-menu${menuOpen ? ' open' : ''}`}>
        {tabs.map(tab => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`nav-mobile-link${active === tab.id ? ' active' : ''}${tab.id === 'topic' ? ' topic-link' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  )
}