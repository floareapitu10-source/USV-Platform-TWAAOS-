'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Event, Category, Profile } from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { ro } from 'date-fns/locale'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { parseSupabaseDate } from '@/lib/utils'

interface EventCalendarProps {
  events: (Event & { category: Category | null; organizer: Profile })[]
}

export function EventCalendar({ events }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Add padding days for complete weeks
  const startDayOfWeek = monthStart.getDay()
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

  const eventsMap = useMemo(() => {
    const map: Record<string, typeof events> = {}
    events.forEach((event) => {
      const dateKey = format(parseSupabaseDate(event.start_date), 'yyyy-MM-dd')
      if (!map[dateKey]) {
        map[dateKey] = []
      }
      map[dateKey].push(event)
    })
    return map
  }, [events])

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return eventsMap[dateKey] || []
  }, [selectedDate, eventsMap])

  const weekDays = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sam', 'Dum']

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">
            {format(currentMonth, 'MMMM yyyy', { locale: ro })}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Astazi
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: paddingDays }).map((_, i) => (
              <div key={`padding-${i}`} className="p-2" />
            ))}
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsMap[dateKey] || []
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isToday = isSameDay(day, new Date())

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'relative p-2 text-center text-sm rounded-lg transition-colors min-h-[60px]',
                    'hover:bg-muted',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                    isToday && !isSelected && 'bg-muted font-bold',
                    !isSameMonth(day, currentMonth) && 'text-muted-foreground'
                  )}
                >
                  <span>{format(day, 'd')}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {dayEvents.slice(0, 3).map((event, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: event.category?.color || '#3B82F6' }}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-xs">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedDate
              ? format(selectedDate, 'd MMMM yyyy', { locale: ro })
              : 'Selecteaza o zi'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDateEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/dashboard/events/${event.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-1 h-full rounded-full self-stretch"
                      style={{ backgroundColor: event.category?.color || '#3B82F6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseSupabaseDate(event.start_date), 'HH:mm', { locale: ro })}
                        {event.location && ` - ${event.location}`}
                      </p>
                      {event.category && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {event.category.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : selectedDate ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Niciun eveniment in aceasta zi
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Selecteaza o zi pentru a vedea evenimentele
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
