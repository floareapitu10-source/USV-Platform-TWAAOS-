import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function toIcsDate(value: string): string {
  const d = new Date(value)
  // iCalendar uses UTC format: YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id,title,description,location,start_date,end_date,external_url,source_url,updated_at')
    .eq('id', id)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const uid = String(event.id)
  const dtstamp = event.updated_at ? toIcsDate(event.updated_at) : toIcsDate(new Date().toISOString())
  const dtstart = toIcsDate(event.start_date)
  const dtend = event.end_date ? toIcsDate(event.end_date) : undefined
  const summary = escapeIcsText(event.title)
  const description = escapeIcsText(event.description || '')
  const location = escapeIcsText(event.location || '')
  const url = event.external_url || event.source_url || ''

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//USV Platform//Events//RO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@usv-platform`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    ...(dtend ? [`DTEND:${dtend}`] : []),
    `SUMMARY:${summary}`,
    ...(description ? [`DESCRIPTION:${description}`] : []),
    ...(location ? [`LOCATION:${location}`] : []),
    ...(url ? [`URL:${escapeIcsText(url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const ics = lines.join('\r\n') + '\r\n'
  const safeTitle = String(event.title)
    .replace(/[^a-z0-9\-_. ]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeTitle || 'event'}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
