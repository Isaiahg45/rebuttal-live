'use client'
import { useState } from 'react'
import Nav from '../components/Nav'
import { useAuth } from '../context/AuthContext'
import Image from 'next/image'

export default function ShopPage() {
  const { user, profile } = useAuth()
  const [proLoading, setProLoading] = useState(false)

  const handleGetPro = async () => {
    if (!user) { window.location.href = '/signup'; return }
    setProLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username: profile?.username }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setProLoading(false)
    }
  }

  const coinDeals = [
    { amount: '25', price: '$0.99', img: '/shop/pile.jpg', label: 'A handful of coins' },
    { amount: '100', price: '$2.99', img: '/shop/box.jpg', label: 'A crate of coins' },
    { amount: '500', price: '$14.99', img: '/shop/wagon.jpg', label: 'A wagon of coins' },
    { amount: '1000', price: '$29.99', img: '/shop/truck.jpg', label: 'A truck of coins' },
  ]

  return (
    <>
      <Nav active="shop" />
      <style>{`
        @keyframes torchFlicker {
          0%,100%{opacity:1;filter:drop-shadow(0 0 8px rgba(255,140,0,0.8))}
          50%{opacity:0.85;filter:drop-shadow(0 0 14px rgba(255,100,0,1))}
        }
        @keyframes proGlow {
          0%,100%{box-shadow:0 0 20px rgba(239,59,86,0.3),0 0 40px rgba(111,107,255,0.15)}
          50%{box-shadow:0 0 32px rgba(239,59,86,0.5),0 0 64px rgba(111,107,255,0.25)}
        }
        .torch-icon{animation:torchFlicker 1.4s ease-in-out infinite}
        .pro-card-glow{animation:proGlow 3s ease-in-out infinite}
      `}</style>

      <div style={{
        minHeight: 'calc(100vh - 56px)',
        overflowY: 'auto',
        backgroundImage: `
          linear-gradient(rgba(4,3,4,0.72), rgba(4,3,4,0.78)),
          url('/shop/dungeon-bg.jpg')
        `,
        backgroundColor: '#080608',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '52px 24px 90px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <div className="torch-icon" style={{ fontSize: '32px', marginBottom: '10px' }}>🔥</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(28px,5vw,40px)', letterSpacing: '4px', color: '#fff' }}>REBUT SHOP</div>
<div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginTop: '8px', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>Home of Rebut Coins and Rebuttal Pro</div>          </div>

          {/* Coin deals */}
         <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '16px', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            🪙 Rebut Coins
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '48px' }}>
            {coinDeals.map(deal => (
<div key={deal.amount} style={{ background: 'rgba(20,17,22,0.92)', border: '1px solid rgba(80,50,100,0.5)', borderRadius: '16px', padding: '20px 16px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(8px)' }}>
                <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <img src={deal.img} alt={deal.label} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                </div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>{deal.amount} Rebut Coins</div>
                <div style={{ color: '#ffd60a', fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '1px', marginBottom: '16px' }}>{deal.price}</div>
                <div style={{ marginTop: 'auto' }}>
                  <button disabled style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 0', color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 700, cursor: 'not-allowed', fontFamily: 'DM Sans, sans-serif' }}>
                    🔒 Coming Soon
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pro card */}
         <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '16px', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            👑 Rebuttal Pro
          </div>
          <div className="pro-card-glow" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(40,12,20,0.95), rgba(10,18,40,0.95))', border: '1px solid rgba(74,42,58,0.8)', borderRadius: '18px', padding: '28px 32px', marginBottom: '56px' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #ff5d76, #6f9bff, #2e6cf6)' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '22px', letterSpacing: '2px', background: 'linear-gradient(90deg, #ff5d76, #6f9bff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    REBUTTAL PRO
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 800, background: '#1fae5e', color: '#fff', padding: '3px 8px', borderRadius: '6px', letterSpacing: '1px' }}>LIVE IN 1.2</span>
                </div>
               <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>$9.99/mo</span>
                  <span>·</span>
                  <span style={{ color: '#ffd60a', fontWeight: 700 }}>+600 Rebut Coins/mo</span>
                  <span style={{ background: 'rgba(255,214,10,0.15)', border: '1px solid rgba(255,214,10,0.3)', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', color: '#ffd60a', fontWeight: 800 }}>COMING IN 1.3</span>
                </div>
                <ul style={{ listStyle: 'none', fontSize: '13.5px', lineHeight: 2, color: 'rgba(255,255,255,0.55)' }}>
                  {[
                    'Self-ID profile badges — politics, religion, ideology, race',
                    'World Cup team fandom badge',
                    '400-word bio on your public profile',
                    'Unlimited buddies (free = 25 max)',
                  ].map(perk => (
                    <li key={perk} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#22c55e', flexShrink: 0, marginTop: '3px' }}>✓</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                {profile?.is_pro ? (
                  <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', padding: '16px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', marginBottom: '6px' }}>👑</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>Pro Active</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>You're all set</div>
                  </div>
                ) : (
                  <button onClick={handleGetPro} disabled={proLoading} style={{ background: 'linear-gradient(100deg, #ef3b56, #6f6bff, #2e6cf6)', border: 'none', borderRadius: '12px', padding: '14px 28px', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: proLoading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 0 28px rgba(111,107,255,0.4)', opacity: proLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                    {proLoading ? 'Redirecting...' : '👑 Get Rebuttal Pro'}
                  </button>
                )}
              </div>
            </div>
          </div>

          </div>
      </div>
    </>
  )
}