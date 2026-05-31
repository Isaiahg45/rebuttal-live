import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export function useNotifications(myUsername: string) {
  const [notifications, setNotifications] = useState<any[]>([])

  const refresh = useCallback(async () => {
    if (!myUsername) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_username', myUsername)
      .eq('seen', false)
      .order('created_at', { ascending: false })
    setNotifications(data ?? [])
  }, [myUsername])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [refresh])

  const markSeen = async (id: string) => {
    await supabase.from('notifications').update({ seen: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const markAllSeen = async () => {
    await supabase.from('notifications').update({ seen: true })
      .eq('recipient_username', myUsername).eq('seen', false)
    setNotifications([])
  }

  return { notifications, refresh, markSeen, markAllSeen }
}