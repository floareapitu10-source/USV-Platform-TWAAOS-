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

  if (params.category) {
    query = query.eq('category_id', params.category)
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

      <EventFilters categories={categories as Category[] || []} />

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
