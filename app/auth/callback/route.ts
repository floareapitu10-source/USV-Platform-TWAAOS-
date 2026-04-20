import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const safeOrigin = (() => {
    try {
      const u = new URL(origin)
      if (u.hostname === '0.0.0.0') u.hostname = 'localhost'
      return u.origin
    } catch {
      return origin
    }
  })()

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Check if user email ends with @student.usv.ro
      const email = data.user?.email
      if (email && email.endsWith('@student.usv.ro')) {
        const isLocalEnv = process.env.NODE_ENV === 'development'

        if (data.user) {
          const fullName =
            (data.user.user_metadata as any)?.full_name ||
            (data.user.user_metadata as any)?.name ||
            null

          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id,role')
            .eq('id', data.user.id)
            .maybeSingle()

          if (!existingProfile) {
            await supabase.from('profiles').insert({
              id: data.user.id,
              email,
              full_name: fullName,
              role: 'student',
              avatar_url: (data.user.user_metadata as any)?.avatar_url || null,
              updated_at: new Date().toISOString(),
            })
          } else {
            await supabase
              .from('profiles')
              .update({
                email,
                full_name: fullName,
                avatar_url: (data.user.user_metadata as any)?.avatar_url || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.user.id)
          }
        }
        
        if (isLocalEnv) {
          // In development, we can redirect to localhost
          return NextResponse.redirect(`${safeOrigin}${next}`)
        } else {
          // In production, redirect to the original domain
          const prodOrigin = process.env.NEXT_PUBLIC_SITE_URL || safeOrigin
          return NextResponse.redirect(`${prodOrigin}${next}`)
        }
      } else {
        // If email doesn't end with @student.usv.ro, sign out and show error
        await supabase.auth.signOut()
        return NextResponse.redirect(`${safeOrigin}/auth/error?error=domain_not_allowed`)
      }
    }
  }

  // Return the user to an error page with some context
  return NextResponse.redirect(`${safeOrigin}/auth/error?error=auth_failed`)
}
