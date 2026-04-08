'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
    setLoading(true)

    try {
      if (registered) {
        const res = await fetch('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, action: 'unregister' }),
        })

        if (res.status === 401) {
          router.push('/auth/login')
          return
        }

        if (!res.ok) {
          throw new Error('Failed to unregister')
        }
        setRegistered(false)
      } else {
        const res = await fetch('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, action: 'register' }),
        })

        if (res.status === 401) {
          router.push('/auth/login')
          return
        }

        if (!res.ok) {
          throw new Error('Failed to register')
        }
        setRegistered(true)
        toast('Inscriere confirmata', {
          description: 'Te-ai inscris la eveniment',
          action: {
            label: 'Vezi',
            onClick: () => {
              window.location.href = '/dashboard/notifications'
            },
          },
          duration: 6000,
        })
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
