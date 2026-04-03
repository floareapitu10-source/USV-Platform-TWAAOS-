import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { RegisterButton } from '@/components/events/register-button'
import type { Event, Category, Profile } from '@/lib/types'
import { Calendar, Clock, MapPin, Users, User, ExternalLink, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import Link from 'next/link'
import { parseSupabaseDate } from '@/lib/utils'

interface EventPageProps {
  params: Promise<{ id: string }>
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: event } = await supabase
    .from('events')
    .select(`
      *,
      category:categories(*),
      organizer:profiles(*)
    `)
    .eq('id', id)
    .single()

  if (!event) {
    notFound()
  }

  const typedEvent = event as Event & { category: Category | null; organizer: Profile }

  // Get registration count
  const { count: registrationCount } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact' })
    .eq('event_id', id)
    .eq('status', 'registered')

  // Check if user is registered
  let isRegistered = false
  if (user) {
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .eq('status', 'registered')
      .single()
    isRegistered = !!registration
  }

  const startDate = parseSupabaseDate(typedEvent.start_date)
  const endDate = typedEvent.end_date ? parseSupabaseDate(typedEvent.end_date) : null
  const isPast = startDate < new Date()
  const isFull = typedEvent.max_participants ? (registrationCount || 0) >= typedEvent.max_participants : false
  const deadlinePassed = typedEvent.registration_deadline 
    ? parseSupabaseDate(typedEvent.registration_deadline) < new Date() 
    : false

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/dashboard/events">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Inapoi la evenimente
        </Link>
      </Button>

      {typedEvent.image_url && (
        <div className="aspect-video relative overflow-hidden rounded-lg">
          <img
            src={typedEvent.image_url}
            alt={typedEvent.title}
            className="object-cover w-full h-full"
          />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {typedEvent.category && (
            <Badge
              variant="outline"
              style={{ borderColor: typedEvent.category.color, color: typedEvent.category.color }}
            >
              {typedEvent.category.name}
            </Badge>
          )}
          <h1 className="text-3xl font-bold">{typedEvent.title}</h1>
          {typedEvent.organizer && (
            <p className="text-muted-foreground">
              Organizat de {typedEvent.organizer.full_name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {isPast ? (
            <Badge variant="secondary">Eveniment incheiat</Badge>
          ) : isFull ? (
            <Badge variant="destructive">Locuri epuizate</Badge>
          ) : deadlinePassed ? (
            <Badge variant="secondary">Inscrieri inchise</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Descriere</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                {typedEvent.description || typedEvent.short_description || 'Nicio descriere disponibila.'}
              </div>
            </CardContent>
          </Card>

          {typedEvent.tags && typedEvent.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Etichete</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {typedEvent.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalii eveniment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">
                    {format(startDate, 'EEEE, d MMMM yyyy', { locale: ro })}
                  </p>
                  {endDate && startDate.toDateString() !== endDate.toDateString() && (
                    <p className="text-sm text-muted-foreground">
                      pana la {format(endDate, 'd MMMM yyyy', { locale: ro })}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">
                    {format(startDate, 'HH:mm', { locale: ro })}
                    {endDate && ` - ${format(endDate, 'HH:mm', { locale: ro })}`}
                  </p>
                </div>
              </div>

              {typedEvent.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{typedEvent.location}</p>
                    {typedEvent.location_details && (
                      <p className="text-sm text-muted-foreground">{typedEvent.location_details}</p>
                    )}
                  </div>
                </div>
              )}

              {typedEvent.max_participants && (
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {registrationCount || 0} / {typedEvent.max_participants} participanti
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {typedEvent.max_participants - (registrationCount || 0)} locuri disponibile
                    </p>
                  </div>
                </div>
              )}

              {typedEvent.organizer && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{typedEvent.organizer.full_name}</p>
                    <p className="text-sm text-muted-foreground">Organizator</p>
                  </div>
                </div>
              )}

              {typedEvent.external_url && (
                <Separator />
              )}

              {typedEvent.external_url && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={typedEvent.external_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Link extern
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {!isPast && user && (
            <RegisterButton
              eventId={typedEvent.id}
              isRegistered={isRegistered}
              isFull={isFull}
              deadlinePassed={deadlinePassed}
            />
          )}

          {typedEvent.registration_deadline && !isPast && (
            <p className="text-sm text-muted-foreground text-center">
              Inscrieri pana la {format(parseSupabaseDate(typedEvent.registration_deadline), 'd MMMM yyyy, HH:mm', { locale: ro })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
