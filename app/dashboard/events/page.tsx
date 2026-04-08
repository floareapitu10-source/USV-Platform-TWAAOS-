import { createClient } from '@/lib/supabase/server'
import { EventCard } from '@/components/events/event-card'
import { EventFilters } from '@/components/events/event-filters'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'
import type { Event, Category, Profile } from '@/lib/types'

interface EventsPageProps {
  searchParams: Promise<{
    search?: string
    category?: string
    date?: string
    organizer?: string
    mode?: string
    op?: string
  }>
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Get categories for filter
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  const { data: organizers } = await supabase
    .from('profiles')
    .select('id,full_name')
    .in('role', ['organizer', 'admin'])
    .order('full_name')

  // Build events query
  let query = supabase
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

  // Apply filters
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`)
  }

  const operator = params.op === 'or' ? 'or' : 'and'
  const orParts: string[] = []

  if (params.category) {
    if (operator === 'or') {
      orParts.push(`category_id.eq.${params.category}`)
    } else {
      query = query.eq('category_id', params.category)
    }
  }

  if (params.organizer) {
    if (operator === 'or') {
      orParts.push(`organizer_id.eq.${params.organizer}`)
    } else {
      query = query.eq('organizer_id', params.organizer)
    }
  }

  if (params.mode) {
    if (operator === 'or') {
      orParts.push(`participation_mode.eq.${params.mode}`)
    } else {
      query = query.eq('participation_mode', params.mode)
    }
  }

  if (orParts.length > 0) {
    query = query.or(orParts.join(','))
  }

  if (params.date) {
    const startOfDay = new Date(params.date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(params.date)
    endOfDay.setHours(23, 59, 59, 999)
    query = query.gte('start_date', startOfDay.toISOString()).lte('start_date', endOfDay.toISOString())
  }

  const { data: events } = await query

  const typedEvents = (events || []) as (Event & { category: Category | null; organizer: Profile })[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Evenimente</h1>
        <p className="text-muted-foreground">
          Descopera toate evenimentele universitare disponibile
        </p>
      </div>

      <EventFilters
        categories={categories as Category[] || []}
        organizers={(organizers || []) as { id: string; full_name: string | null }[]}
      />

      {typedEvents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {typedEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Niciun eveniment gasit</CardTitle>
            <CardDescription>
              Incearca sa modifici filtrele sau sa cauti altceva
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
