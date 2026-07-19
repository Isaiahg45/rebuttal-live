'use client'
import { useState } from 'react'
import Nav from '../components/Nav'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function ShopPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [purchasedItems, setPurchasedItems] = useState<Record<string, boolean>>({})

  const coinDeals = [
    { amount: 25, coins: 25, price: '$0.99', img: '/shop/pile.jpg', label: 'A handful of coins', priceId: 'price_1Tv04f7SmeyMcXEqDNI4ajU5' },
    { amount: 100, coins: 100, price: '$2.99', img: '/shop/box.jpg', label: 'A crate of coins', priceId: 'price_1Tv05O7SmeyMcXEqRUQh9dEC' },
    { amount: 500, coins: 500, price: '$14.99', img: '/shop/wagon.jpg', label: 'A wagon of coins', priceId: 'price_1Tv0657SmeyMcXEqdatJnoUu' },
    { amount: 1000, coins: 1000, price: '$29.99', img: '/shop/truck.jpg', label: 'A truck of coins', priceId: 'price_1Tv0787SmeyMcXEqPGEPKZ7q' },
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

  const handleCoinPurchase = async (itemId: string, cost: number, action: () => Promise<void>) => {
    if (!user || !profile?.username) { window.location.href = '/signup'; return }
    const myCoins = profile?.coins ?? 0
    if (myCoins < cost) { alert(`You need ${cost} 💰 Rebut coins. You have ${myCoins}.`); return }
    const confirmed = window.confirm(`Purchase for ${cost} 💰 Rebut coins? You have ${myCoins}.`)
    if (!confirmed) return
    setLoadingId(itemId)
    try {
      await supabase.from('profiles').update({ coins: myCoins - cost }).eq('username', profile.username)
      await action()
      await refreshProfile()
      setPurchasedItems(prev => ({ ...prev, [itemId]: true }))
    } catch (e) {
      alert('Purchase failed. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  const myCoins = profile?.coins ?? 0
  const hasUnlimitedBuddies = (profile as any)?.unlimited_buddies ?? false
  const hasBio = profile?.bio !== undefined && profile?.bio !== null
  const badges = (profile as any)?.badges ?? []

  const coinItems = [
    {
      id: 'bet',
      icon: '🎰',
      label: 'Bet on Debates',
      desc: 'Place bets (20–150 coins) on any live debate. Win your bet if your pick wins.',
      cost: '20–150 coins',
      costNum: null,
      buttonLabel: 'Go to Lobby',
      onClick: () => window.location.href = '/rebut',
      alreadyOwned: false,
    },
    {
      id: 'elo',
      icon: '🏟️',
      label: 'Buy Into ELO Games',
      desc: "Don't have enough ELO? Buy your way in for 30 coins per ELO point you're short.",
      cost: '30 coins/ELO pt',
      costNum: null,
      buttonLabel: 'Available at Join',
      onClick: null,
      alreadyOwned: false,
    },
    {
      id: 'avatar',
      icon: '🖼️',
      label: 'Change Profile Picture',
      desc: 'First upload is free. Every change after costs 500 coins.',
      cost: '500 coins',
      costNum: 500,
      buttonLabel: 'Go to Profile',
      onClick: () => window.location.href = '/profile',
      alreadyOwned: false,
    },
    {
      id: 'buddy',
      icon: '🤝',
      label: 'Add Buddies',
      desc: 'Send a buddy request to another debater. Free accounts max out at 25 buddies.',
      cost: '25 coins per request',
      costNum: null,
      buttonLabel: 'Available on Profiles',
      onClick: null,
      alreadyOwned: false,
    },
    {
      id: 'bio',
      icon: '📝',
      label: 'Profile Bio',
      desc: 'Write a bio on your public profile. One-time unlock.',
      cost: '50 coins',
      costNum: 50,
      buttonLabel: hasBio ? '✅ Already Unlocked' : `Unlock Bio — 50 💰`,
      onClick: hasBio ? null : async () => {
        await handleCoinPurchase('bio', 50, async () => {
          await supabase.from('profiles').update({ bio: '' }).eq('username', profile?.username)
        })
      },
      alreadyOwned: hasBio,
    },
    {
      id: 'badges',
      icon: '🏷️',
      label: 'Self-ID Badges',
      desc: 'Add identity badges to your profile (politics, religion, ideology, and more).',
      cost: '50 coins each',
      costNum: null,
      buttonLabel: 'Add on Profile',
      onClick: () => window.location.href = '/profile',
      alreadyOwned: false,
    },
    {
      id: 'unlimited_buddies',
      icon: '👥',
      label: 'Unlimited Buddies',
      desc: 'Free accounts max out at 25 buddies. Unlock unlimited forever.',
      cost: '400 coins',
      costNum: 400,
      buttonLabel: hasUnlimitedBuddies ? '✅ Already Unlocked' : `Unlock — 400 💰`,
      onClick: hasUnlimitedBuddies ? null : async () => {
        await handleCoinPurchase('unlimited_buddies', 400, async () => {
          await supabase.from('profiles').update({ unlimited_buddies: true }).eq('username', profile?.username)
        })
      },
      alreadyOwned: hasUnlimitedBuddies,
    },
  ]

  return (
    <>
      <Nav active="shop" />
      <style>{`
        @keyframes torchFlicker {
          0%,100%{opacity:1;filter:drop-shadow(0 0 8px rgba(255,140,0,0.8))}
          50%{opacity:0.85;filter:drop-shadow(0 0 14px rgba(255,100,0,1))}
        }
        .torch-icon{animation:torchFlicker 1.4s ease-in-out infinite}
        .coin-card:hover{transform:translateY(-4px);border-color:rgba(255,214,10,0.5)!important;box-shadow:0 0 28px rgba(255,214,10,0.2)!important;}
        .coin-card{transition:transform 0.2s,border-color 0.2s,box-shadow 0.2s;}
        .item-card:hover{border-color:rgba(168,85,247,0.4)!important;}
        .item-card{transition:border-color 0.2s;}
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
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffd60a' }}>{myCoins} coins</span>
              </div>
            )}
          </div>

          {/* Monthly free coins notice */}
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '14px', padding: '14px 20px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🎁</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', marginBottom: '2px' }}>100 Free Rebut Coins every month</div>
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

          {/* Coin items */}
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '16px' }}>
            💰 What Can You Do With Rebut Coins?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '48px' }}>
            {coinItems.map(item => (
              <div key={item.id} className="item-card" style={{ background: 'rgba(20,17,22,0.85)', border: `1px solid ${item.alreadyOwned ? 'rgba(34,197,94,0.3)' : 'rgba(80,50,100,0.4)'}`, borderRadius: '12px', padding: '16px', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '20px' }}>{item.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: item.alreadyOwned ? '#22c55e' : '#fff' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, flex: 1 }}>{item.desc}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#ffd60a', background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)', borderRadius: '6px', padding: '2px 8px', display: 'inline-block', alignSelf: 'flex-start' }}>{item.cost}</div>
                {item.onClick && !item.alreadyOwned && (
                  <button
                    onClick={item.onClick}
                    disabled={loadingId === item.id}
                    style={{ width: '100%', background: item.costNum ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.2))' : 'rgba(255,255,255,0.06)', border: `1px solid ${item.costNum ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '9px', color: item.costNum ? '#c084fc' : 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700, cursor: loadingId === item.id ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: '4px' }}
                  >
                    {loadingId === item.id ? 'Processing...' : item.buttonLabel}
                  </button>
                )}
                {item.alreadyOwned && (
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>✅ Unlocked</div>
                )}
                {!item.onClick && !item.alreadyOwned && item.buttonLabel && (
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '4px', fontStyle: 'italic' }}>{item.buttonLabel}</div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}