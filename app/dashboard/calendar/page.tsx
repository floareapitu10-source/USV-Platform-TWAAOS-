import { createClient } from '@/lib/supabase/server'
import { EventCalendar } from '@/components/events/event-calendar'
import type { Event, Category, Profile } from '@/lib/types'

export default async function CalendarPage() {
  const supabase = await createClient()

  // Get events for the next 3 months
  const startDate = new Date()
  startDate.setDate(1) // Start of current month
  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + 3)

  const { data: events } = await supabase
    .from('events')
    .select(`
      *,
      category:categories(*),
      organizer:profiles(*)
    `)
    .eq('status', 'published')
    .eq('is_public', true)
    .gte('start_date', startDate.toISOString())
    .lte('start_date', endDate.toISOString())
    .order('start_date', { ascending: true })

  const typedEvents = (events || []) as (Event & { category: Category | null; organizer: Profile })[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calendar evenimente</h1>
        <p className="text-muted-foreground">
          Vizualizeaza evenimentele in format calendar
        </p>
      </div>

      <EventCalendar events={typedEvents} />
    </div>
  )
}
