import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EventForm } from '@/components/events/event-form'
import type { Category, Event } from '@/lib/types'

interface EditEventPageProps {
  params: Promise<{ id: string }>
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params
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

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('organizer_id', user.id)
    .single()

  if (!event) {
    notFound()
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editeaza evenimentul</h1>
        <p className="text-muted-foreground">
          Modifica detaliile evenimentului
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalii eveniment</CardTitle>
          <CardDescription>
            Actualizeaza informatiile despre eveniment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm 
            categories={categories as Category[] || []} 
            organizerId={user.id}
            event={event as Event}
          />
        </CardContent>
      </Card>
    </div>
  )
}
