import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/settings/profile-form'
import type { Profile } from '@/lib/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const typedProfile: Profile = profile || {
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Setari</h1>
        <p className="text-muted-foreground">
          Gestioneaza profilul si preferintele tale
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Actualizeaza informatiile profilului tau
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={typedProfile} />
        </CardContent>
      </Card>
    </div>
  )
}
