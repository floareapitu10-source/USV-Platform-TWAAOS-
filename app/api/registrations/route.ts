import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

type Action = 'register' | 'unregister'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  let emailAttempted = false
  let emailSent = false
  let emailError: string | null = null

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { eventId?: string; action?: Action }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventId = body.eventId
  const action = body.action

  if (!eventId || (action !== 'register' && action !== 'unregister')) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (action === 'unregister') {
    const { error } = await supabase
      .from('event_registrations')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  const { error: upsertError } = await supabase
    .from('event_registrations')
    .upsert(
      {
        event_id: eventId,
        user_id: user.id,
        status: 'registered',
        cancelled_at: null,
      },
      {
        onConflict: 'event_id,user_id',
      }
    )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id,title,start_date,location')
    .eq('id', eventId)
    .single()

  if (event) {
    await supabase.from('notifications').insert({
      user_id: user.id,
      event_id: eventId,
      type: 'registration_confirmed',
      title: 'Inscriere confirmata',
      message: `Te-ai inscris la evenimentul: ${event.title}`,
    })

    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL

    const toEmail = user.email

    if (resendKey && fromEmail && toEmail) {
      emailAttempted = true
      try {
        const resend = new Resend(resendKey)
        const when = new Date(event.start_date).toLocaleString('ro-RO')
        const subject = `Confirmare inscriere: ${event.title}`
        const text = [
          'Inscriere confirmata!',
          '',
          `Eveniment: ${event.title}`,
          `Data: ${when}`,
          event.location ? `Locatie: ${event.location}` : null,
          '',
          'Ne vedem acolo!',
        ]
          .filter(Boolean)
          .join('\n')

        const result = await resend.emails.send({
          from: fromEmail,
          to: toEmail,
          subject,
          text,
        })

        if ((result as any)?.error) {
          emailError = String((result as any).error?.message || (result as any).error)
        } else {
          emailSent = true
        }
      } catch {
        // Ignore email errors; in-app notification is still created.
        emailError = 'Resend send failed'
      }
    } else {
      if (!resendKey) emailError = 'Missing RESEND_API_KEY'
      else if (!fromEmail) emailError = 'Missing RESEND_FROM_EMAIL'
      else if (!toEmail) emailError = 'Missing user email'
    }
  }

  return NextResponse.json({
    ok: true,
    email: {
      attempted: emailAttempted,
      sent: emailSent,
      error: emailError,
    },
  })
}
