import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Event, EventRegistration, Profile } from '@/lib/types'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { ArrowLeft, Download, Users } from 'lucide-react'
import Link from 'next/link'
import { ExportButton } from '@/components/events/export-button'

interface RegistrationsPageProps {
  params: Promise<{ id: string }>
}

export default async function RegistrationsPage({ params }: RegistrationsPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('organizer_id', user.id)
    .single()

  if (!event) {
    notFound()
  }

  const { data: registrations } = await supabase
    .from('event_registrations')
    .select(`
      *,
      user:profiles(*)
    `)
    .eq('event_id', id)
    .order('registered_at', { ascending: false })

  const typedRegistrations = (registrations || []) as (EventRegistration & { user: Profile })[]

  const statusColors: Record<string, string> = {
    registered: 'bg-green-100 text-green-800',
    waitlist: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
    attended: 'bg-blue-100 text-blue-800',
  }

  const statusLabels: Record<string, string> = {
    registered: 'Inscris',
    waitlist: 'Lista asteptare',
    cancelled: 'Anulat',
    attended: 'Prezent',
  }

  const activeRegistrations = typedRegistrations.filter(r => r.status === 'registered')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/my-events">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Inapoi
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inscrieri</h1>
          <p className="text-muted-foreground">{event.title}</p>
        </div>
        <ExportButton registrations={typedRegistrations} eventTitle={event.title} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total inscrieri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typedRegistrations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inscrieri active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRegistrations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Locuri disponibile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {event.max_participants 
                ? Math.max(0, event.max_participants - activeRegistrations.length)
                : 'Nelimitat'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista participanti</CardTitle>
          <CardDescription>
            Toti participantii inscrisi la acest eveniment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typedRegistrations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Facultate</TableHead>
                  <TableHead>Data inscrierii</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typedRegistrations.map((registration) => (
                  <TableRow key={registration.id}>
                    <TableCell className="font-medium">
                      {registration.user?.full_name || '-'}
                    </TableCell>
                    <TableCell>{registration.user?.email || '-'}</TableCell>
                    <TableCell>{registration.user?.faculty || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(registration.registered_at), 'd MMM yyyy, HH:mm', { locale: ro })}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[registration.status]}>
                        {statusLabels[registration.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nicio inscriere</p>
              <p className="text-sm text-muted-foreground">
                Nu exista inscrieri pentru acest eveniment
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
