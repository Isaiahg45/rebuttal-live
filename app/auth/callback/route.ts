import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  if (code) {
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('Auth callback - session:', session?.user?.id, 'error:', error)

    if (session?.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle()

      console.log('Profile check:', profile, 'error:', profileError)

      if (!profile?.username) {
        // Upsert empty profile
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: session.user.id,
            elo: 0,
            wins: 0,
            losses: 0,
            debates: 0,
          }, { onConflict: 'id' })

        console.log('Upsert error:', upsertError)
        return NextResponse.redirect(new URL('/username', requestUrl.origin))
      }
    }
  }

return NextResponse.redirect(new URL('/rebut', requestUrl.origin))
}