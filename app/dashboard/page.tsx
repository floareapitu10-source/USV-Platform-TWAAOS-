import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Calendar, Users, CalendarCheck, Bell, Plus, ArrowRight } from 'lucide-react'
import type { Event, Profile } from '@/lib/types'
import { EventCard } from '@/components/events/event-card'

async function getUpcomingEvents(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const { data } = await supabase
    .from('events')
    .select(`
      *,
      category:categories(*),
      organizer:profiles(*)
    `)
    .eq('status', 'published')
    .eq('is_public', true)
    .gte('start_date', new Date().toISOString())
    .order('start_date', { ascending: true })
    .limit(6)

  return data as (Event & { category: Event['category']; organizer: Profile })[] || []
}

async function getStats(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, userId: string) {
  const [eventsResult, registrationsResult, notificationsResult] = await Promise.all([
    supabase
      .from('events')
      .select('id', { count: 'exact' })
      .eq('status', 'published')
      .eq('is_public', true)
      .gte('start_date', new Date().toISOString()),
    supabase
      .from('event_registrations')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'registered'),
    supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false),
  ])

  return {
    upcomingEvents: eventsResult.count || 0,
    myRegistrations: registrationsResult.count || 0,
    unreadNotifications: notificationsResult.count || 0,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const [events, stats] = await Promise.all([
    getUpcomingEvents(supabase),
    getStats(supabase, user.id),
  ])

  const isOrganizer = profile?.role === 'organizer' || profile?.role === 'admin'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Bine ai venit, {profile?.full_name?.split(' ')[0] || 'Student'}!
          </h1>
          <p className="text-muted-foreground">
            Descopera evenimentele universitare din Suceava
          </p>
        </div>
        {isOrganizer && (
          <Button asChild>
            <Link href="/dashboard/my-events/new">
              <Plus className="mr-2 h-4 w-4" />
              Eveniment nou
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evenimente viitoare</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingEvents}</div>
            <p className="text-xs text-muted-foreground">
              evenimente disponibile
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inscrierile mele</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.myRegistrations}</div>
            <p className="text-xs text-muted-foreground">
              evenimente la care participi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notificari</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unreadNotifications}</div>
            <p className="text-xs text-muted-foreground">
              notificari necitite
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Evenimente viitoare</h2>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/events">
              Vezi toate <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        {events.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">Niciun eveniment viitor</CardTitle>
              <CardDescription>
                Nu exista evenimente programate momentan
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
