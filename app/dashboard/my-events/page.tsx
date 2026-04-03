import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Calendar, Edit, Eye, Users } from 'lucide-react'
import type { Event, Category } from '@/lib/types'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { parseSupabaseDate } from '@/lib/utils'

export default async function MyEventsPage() {
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

  const { data: events } = await supabase
    .from('events')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: false })

  // Get registration counts for all events
  const eventIds = events?.map(e => e.id) || []
  const { data: registrationCounts } = await supabase
    .from('event_registrations')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('status', 'registered')

  const countMap: Record<string, number> = {}
  registrationCounts?.forEach(r => {
    countMap[r.event_id] = (countMap[r.event_id] || 0) + 1
  })

  const typedEvents = (events || []) as (Event & { category: Category | null })[]

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-gray-100 text-gray-800',
  }

  const statusLabels: Record<string, string> = {
    draft: 'Ciorna',
    published: 'Publicat',
    cancelled: 'Anulat',
    completed: 'Incheiat',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Evenimentele mele</h1>
          <p className="text-muted-foreground">
            Gestioneaza evenimentele pe care le organizezi
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/my-events/new">
            <Plus className="mr-2 h-4 w-4" />
            Eveniment nou
          </Link>
        </Button>
      </div>

      {typedEvents.length > 0 ? (
        <div className="grid gap-4">
          {typedEvents.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={statusColors[event.status]}>
                        {statusLabels[event.status]}
                      </Badge>
                      {event.category && (
                        <Badge variant="outline" style={{ borderColor: event.category.color }}>
                          {event.category.name}
                        </Badge>
                      )}
                      {event.is_featured && (
                        <Badge variant="secondary">Recomandat</Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(parseSupabaseDate(event.start_date), 'd MMM yyyy, HH:mm', { locale: ro })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {countMap[event.id] || 0} {event.max_participants ? `/ ${event.max_participants}` : ''} participanti
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/events/${event.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Vezi
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/my-events/${event.id}/edit`}>
                        <Edit className="h-4 w-4 mr-1" />
                        Editeaza
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/my-events/${event.id}/registrations`}>
                        <Users className="h-4 w-4 mr-1" />
                        Inscrieri
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Niciun eveniment</CardTitle>
            <CardDescription className="mb-4">
              Nu ai creat niciun eveniment inca
            </CardDescription>
            <Button asChild>
              <Link href="/dashboard/my-events/new">
                <Plus className="mr-2 h-4 w-4" />
                Creeaza primul eveniment
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
