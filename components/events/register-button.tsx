'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

interface RegisterButtonProps {
  eventId: string
  isRegistered: boolean
  isFull: boolean
  deadlinePassed: boolean
}

export function RegisterButton({ eventId, isRegistered, isFull, deadlinePassed }: RegisterButtonProps) {
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(isRegistered)
  const router = useRouter()

  const handleRegister = async () => {
    const supabase = createClient()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      if (registered) {
        // Unregister
        await supabase
          .from('event_registrations')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('event_id', eventId)
          .eq('user_id', user.id)
        setRegistered(false)
      } else {
        // Register
        await supabase
          .from('event_registrations')
          .upsert({
            event_id: eventId,
            user_id: user.id,
            status: 'registered',
            cancelled_at: null,
          }, {
            onConflict: 'event_id,user_id',
          })
        setRegistered(true)
      }
      router.refresh()
    } catch (error) {
      console.error('Registration error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (isFull && !registered) {
    return (
      <Button disabled className="w-full">
        Locuri epuizate
      </Button>
    )
  }

  if (deadlinePassed && !registered) {
    return (
      <Button disabled className="w-full">
        Inscrieri inchise
      </Button>
    )
  }

  return (
    <Button
      onClick={handleRegister}
      disabled={loading}
      variant={registered ? 'outline' : 'default'}
      className="w-full"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Se proceseaza...
        </>
      ) : registered ? (
        <>
          <CheckCircle className="mr-2 h-4 w-4" />
          Inscris - Anuleaza inscrierea
        </>
      ) : (
        'Inscrie-te la eveniment'
      )}
    </Button>
  )
}
