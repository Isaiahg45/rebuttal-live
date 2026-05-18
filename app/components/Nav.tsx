'use client'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

interface NavProps { active: string }

export default function Nav({ active }: NavProps) {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

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
    <nav style={{
      background: 'rgba(8,8,8,0.97)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      height: '56px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link href="/" style={{ marginRight: 'auto', display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '3px', color: 'var(--accent)' }}>REBUTTAL</span>
        <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '3px', color: 'var(--text)' }}>.LIVE</span>
      </Link>

      <div style={{ display: 'flex', gap: '4px' }}>
        {tabs.map(tab => tab.id === 'topic' ? (
          <Link key={tab.id} href={tab.href} style={{
            padding: '6px 16px', fontSize: '13px', fontWeight: 700, borderRadius: '6px',
            color: '#fff',
            background: 'linear-gradient(90deg, #e63946, #ff6b35)',
            border: 'none',
            animation: 'navPulse 2s ease-in-out infinite',
            whiteSpace: 'nowrap',
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '20px', minWidth: '180px', justifyContent: 'flex-end' }}>
        {loading ? (
          <div style={{ width: '120px', height: '28px', background: 'var(--surface2)', borderRadius: '20px', opacity: 0.3, animation: 'pulse 1.5s infinite' }} />
        ) : user ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '4px 12px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{profile?.elo ?? 0}</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>ELO</span>
            </div>
            <div
              onClick={() => router.push('/profile')}
              title={profile?.username ?? 'Profile'}
              style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#ff8c69)', border: '2px solid rgba(230,57,70,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: '#fff', flexShrink: 0 }}
            >{initials}</div>
            <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '8px', whiteSpace: 'nowrap' }}>
              Log in
            </Link>
            <Link href="/signup" style={{ padding: '7px 18px', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: '8px', whiteSpace: 'nowrap' }}>
              Sign up
            </Link>
          </>
        )}
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
        @keyframes navPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(230,57,70,0.7), 0 0 16px rgba(255,107,53,0.4); }
          50% { box-shadow: 0 0 18px rgba(230,57,70,1), 0 0 36px rgba(255,107,53,0.7), 0 0 54px rgba(230,57,70,0.3); }
        }
      `}</style>
    </nav>
  )
}