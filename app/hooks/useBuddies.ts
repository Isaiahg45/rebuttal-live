import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export function useBuddies(myUsername: string, isPro: boolean = false) {
  const [buddies, setBuddies] = useState<string[]>([])
  const [pendingReceived, setPendingReceived] = useState<string[]>([])
  const [pendingSent, setPendingSent] = useState<string[]>([])
  const BUDDY_LIMIT = 25

  const refresh = useCallback(async () => {
    if (!myUsername) return
    const { data } = await supabase
      .from('buddies')
      .select('*')
      .or(`requester_username.eq.${myUsername},recipient_username.eq.${myUsername}`)
    if (!data) return
    const accepted = data.filter(r => r.status === 'accepted')
    const received = data.filter(r => r.status === 'pending' && r.recipient_username === myUsername)
    const sent = data.filter(r => r.status === 'pending' && r.requester_username === myUsername)
    setBuddies(accepted.map(r => r.requester_username === myUsername ? r.recipient_username : r.requester_username))
    setPendingReceived(received.map(r => r.requester_username))
    setPendingSent(sent.map(r => r.recipient_username))
  }, [myUsername])

  useEffect(() => { refresh() }, [refresh])

  const sendRequest = async (toUsername: string): Promise<{ error?: string }> => {
    if (!isPro && buddies.length >= BUDDY_LIMIT) {
      return { error: `You've reached the ${BUDDY_LIMIT} buddy limit. Upgrade to Rebuttal Pro for unlimited buddies.` }
    }
    await supabase.from('buddies').insert({ requester_username: myUsername, recipient_username: toUsername })
    await supabase.from('notifications').insert({
      recipient_username: toUsername,
      type: 'buddy_request',
      message: `🤝 ${myUsername} sent you a buddy request!`,
    })
    refresh()
    return {}
  }

  const acceptRequest = async (fromUsername: string) => {
    await supabase.from('buddies').update({ status: 'accepted' })
      .eq('requester_username', fromUsername).eq('recipient_username', myUsername)
    await supabase.from('notifications').insert({
      recipient_username: fromUsername,
      type: 'buddy_accepted',
      message: `🤝 ${myUsername} accepted your buddy request! You're now buddies.`,
    })
    refresh()
  }

  const declineRequest = async (fromUsername: string) => {
    await supabase.from('buddies').delete()
      .eq('requester_username', fromUsername).eq('recipient_username', myUsername)
    refresh()
  }

  const removeBuddy = async (otherUsername: string) => {
    await supabase.from('buddies').delete()
      .or(`and(requester_username.eq.${myUsername},recipient_username.eq.${otherUsername}),and(requester_username.eq.${otherUsername},recipient_username.eq.${myUsername})`)
    refresh()
  }

  return { buddies, pendingReceived, pendingSent, sendRequest, acceptRequest, declineRequest, removeBuddy, refresh, buddyLimit: BUDDY_LIMIT, atLimit: !isPro && buddies.length >= BUDDY_LIMIT }
}