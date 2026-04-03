import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EventForm } from '@/components/events/event-form'
import type { Category } from '@/lib/types'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'student') {
    redirect('/dashboard')
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Eveniment nou</h1>
        <p className="text-muted-foreground">
          Creeaza un nou eveniment pentru comunitatea universitara
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalii eveniment</CardTitle>
          <CardDescription>
            Completeaza informatiile despre eveniment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm 
            categories={categories as Category[] || []} 
            organizerId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
