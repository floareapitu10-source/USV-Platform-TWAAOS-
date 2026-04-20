'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Event, Category, Profile } from '@/lib/types'
import { Calendar, MapPin, Users, Clock, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { parseSupabaseDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface EventCardProps {
  event: Event & { category?: Category | null; organizer?: Profile | null }
  showActions?: boolean
  canDelete?: boolean
  onDelete?: (eventId: string) => void | Promise<void>
}

export function EventCard({ event, showActions = true, canDelete, onDelete }: EventCardProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (canDelete !== undefined) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (data?.role === 'admin') setIsAdmin(true)
    })
  }, [canDelete])

  const showDelete = canDelete ?? isAdmin

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Sterge evenimentul "${event.title}"?`)) return
    setDeleting(true)
    try {
      if (onDelete) {
        await onDelete(event.id)
      } else {
        const supabase = createClient()
        const { error } = await supabase.from('events').delete().eq('id', event.id)
        if (error) {
          alert(`Stergere esuata: ${error.message}`)
          return
        }
      }
      setDeleted(true)
    } finally {
      setDeleting(false)
    }
  }

  if (deleted) return null

  const startDate = parseSupabaseDate(event.start_date)
  const formattedDate = format(startDate, 'd MMMM yyyy', { locale: ro })
  const formattedTime = format(startDate, 'HH:mm', { locale: ro })

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      {event.image_url && (
        <div className="aspect-video relative overflow-hidden">
          <img
            src={event.image_url}
            alt={event.title}
            className="object-cover w-full h-full"
          />
          {event.is_featured && (
            <Badge className="absolute top-2 right-2" variant="secondary">
              Recomandat
            </Badge>
          )}
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            {event.category && (
              <Badge
                variant="outline"
                style={{ borderColor: event.category.color, color: event.category.color }}
              >
                {event.category.name}
              </Badge>
            )}
            <h3 className="font-semibold leading-tight line-clamp-2">
              {event.title}
            </h3>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        {event.short_description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {event.short_description}
          </p>
        )}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>{formattedTime}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.max_participants && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span>{event.max_participants} locuri</span>
            </div>
          )}
        </div>
      </CardContent>
      {showActions && (
        <CardFooter className="pt-2 gap-2">
          <Button asChild className="flex-1">
            <Link href={`/dashboard/events/${event.id}`}>
              Vezi detalii
            </Link>
          </Button>
          {showDelete && (
            <Button
              variant="outline"
              size="icon"
              disabled={deleting}
              onClick={handleDelete}
              aria-label="Sterge eveniment"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
