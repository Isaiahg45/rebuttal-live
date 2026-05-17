'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface AuthContextType {
  user: any
  profile: any
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(undefined) // undefined = not yet resolved
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data ?? null)
    return data
  }

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) fetchProfile(session.user.id)
  }

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        setLoading(false)
        fetchProfile(session.user.id) // background, no await
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)