'use client'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'

export default function AuthRedirect() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user && !profile?.username) {
      router.push('/username')
    }
  }, [user, profile, loading])

  return null
}