'use client'
import { useState } from 'react'
import Nav from '../components/Nav'
import { useAuth } from '../context/AuthContext'

export default function ShopPage() {
  const { user, profile } = useAuth()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const coinDeals = [
    { amount: 25, coins: 25, price: '$0.99', img: '/shop/pile.jpg', label: 'A handful of coins', priceId: 'REPLACE_WITH_PRICE_ID_25' },
    { amount: 100, coins: 100, price: '$2.99', img: '/shop/box.jpg', label: 'A crate of coins', priceId: 'REPLACE_WITH_PRICE_ID_100' },
    { amount: 500, coins: 500, price: '$14.99', img: '/shop/wagon.jpg', label: 'A wagon of coins', priceId: 'REPLACE_WITH_PRICE_ID_500' },
    { amount: 1000, coins: 1000, price: '$29.99', img: '/shop/truck.jpg', label: 'A truck of coins', priceId: 'REPLACE_WITH_PRICE_ID_1000' },
  ]

  const handleBuyCoins = async (priceId: string, coins: number) => {
    if (!user) { window.location.href = '/signup'; return }
    setLoadingId(priceId)
    try {
      const res = await fetch('/api/stripe/coins-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username: profile?.username, priceId, coins }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Something went wrong. Please try again.')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      <Nav active="shop" />
      <style>{`
        @keyframes torchFlicker {
          0%,100%{opacity:1;filter:drop-shadow(0 0 8px rgba(255,140,0,0.8))}
          50%{opacity:0.85;filter:drop-shadow(0 0 14px rgba(255,100,0,1))}
        }
        @keyframes coinGlow {
          0%,100%{box-shadow:0 0 16px rgba(255,214,10,0.15)}
          50%{box-shadow:0 0 28px rgba(255,214,10,0.3)}
        }
        .torch-icon{animation:torchFlicker 1.4s ease-in-out infinite}
        .coin-card:hover{transform:translateY(-4px);border-color:rgba(255,214,10,0.5)!important;box-shadow:0 0 28px rgba(255,214,10,0.2)!important;}
        .coin-card{transition:transform 0.2s,border-color 0.2s,box-shadow 0.2s;}
      `}</style>

      <div style={{
        minHeight: 'calc(100vh - 56px)',
        overflowY: 'auto',
        backgroundImage: `linear-gradient(rgba(4,3,4,0.72), rgba(4,3,4,0.88)), url('/shop/dungeon-bg.jpg')`,
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
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '8px' }}>Buy Rebut Coins — use them to bet, buy into games, and more</div>
            {profile && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '12px', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.25)', borderRadius: '20px', padding: '6px 16px' }}>
                <img src="/rebut-coin.png" alt="RC" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffd60a' }}>{profile.coins ?? 0} coins</span>
              </div>
            )}
          </div>

          {/* Monthly free coins notice */}
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '14px', padding: '14px 20px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🎁</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', marginBottom: '2px' }}>200 Free Rebut Coins every month</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Automatically credited to your account at the start of each month. No purchase needed.</div>
            </div>
          </div>

          {/* Coin deals */}
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '16px' }}>
            🪙 Rebut Coins
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '48px' }}>
            {coinDeals.map(deal => (
              <div key={deal.amount} className="coin-card" style={{ background: 'rgba(20,17,22,0.92)', border: '1px solid rgba(80,50,100,0.5)', borderRadius: '16px', padding: '20px 16px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', backdropFilter: 'blur(8px)' }}>
                <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <img src={deal.img} alt={deal.label} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                </div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>{deal.amount} Rebut Coins</div>
                <div style={{ color: '#ffd60a', fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '1px', marginBottom: '16px' }}>{deal.price}</div>
                <div style={{ marginTop: 'auto' }}>
                  {!user ? (
                    <button onClick={() => window.location.href = '/signup'} style={{ width: '100%', background: 'linear-gradient(135deg,#e63946,#ff6b35)', border: 'none', borderRadius: '10px', padding: '11px 0', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      Sign Up to Buy
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuyCoins(deal.priceId, deal.coins)}
                      disabled={loadingId === deal.priceId}
                      style={{ width: '100%', background: loadingId === deal.priceId ? 'rgba(255,214,10,0.1)' : 'linear-gradient(135deg, rgba(255,214,10,0.15), rgba(255,149,0,0.15))', border: '1px solid rgba(255,214,10,0.4)', borderRadius: '10px', padding: '11px 0', color: '#ffd60a', fontSize: '13px', fontWeight: 700, cursor: loadingId === deal.priceId ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {loadingId === deal.priceId ? 'Redirecting...' : `Buy ${deal.amount} Coins`}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* What can you do with coins */}
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '16px' }}>
            💰 What Can You Do With Rebut Coins?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '48px' }}>
            {[
              { icon: '🎰', label: 'Bet on Debates', desc: 'Place bets (20–150 coins) on any live debate. Win your bet if your pick wins.', cost: '20–150 coins' },
              { icon: '🏟️', label: 'Buy Into ELO Games', desc: "Don't have enough ELO? Buy your way in for 30 coins per ELO point you're short.", cost: '30 coins/ELO pt' },
              { icon: '🖼️', label: 'Change Profile Picture', desc: 'First upload is free. Every change after costs coins.', cost: '500 coins' },
              { icon: '🤝', label: 'Add Buddies', desc: 'Send a buddy request to another debater.', cost: '25 coins' },
              { icon: '📝', label: 'Profile Bio', desc: 'Write a bio on your public profile.', cost: '50 coins' },
              { icon: '🏷️', label: 'Self-ID Badges', desc: 'Add identity badges to your profile (politics, religion, ideology).', cost: '50 coins each' },
              { icon: '👥', label: 'Unlimited Buddies', desc: 'Free accounts max out at 25 buddies. Unlock unlimited.', cost: '50 coins' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(20,17,22,0.85)', border: '1px solid rgba(80,50,100,0.4)', borderRadius: '12px', padding: '16px', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>{item.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: '8px' }}>{item.desc}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#ffd60a', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)', borderRadius: '6px', padding: '2px 8px', display: 'inline-block' }}>{item.cost}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}