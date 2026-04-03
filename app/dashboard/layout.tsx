import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import type { Profile } from '@/lib/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const userProfile: Profile = profile || {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || user.email,
    role: user.user_metadata?.role || 'student',
    avatar_url: null,
    faculty: user.user_metadata?.faculty || null,
    year_of_study: user.user_metadata?.year_of_study || null,
    phone: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <DashboardSidebar profile={userProfile} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader profile={userProfile} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
