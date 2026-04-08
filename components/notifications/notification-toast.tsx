'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Notification } from '@/lib/types'

let lastSeenNotificationId: string | null = null

export function NotificationToastProvider() {
  const supabase = createClient()

  useEffect(() => {
    let mounted = true
    let channel: any

    const setupChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return

      channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('NotificationToastProvider payload:', payload)
            const notification = payload.new as Notification
            if (notification.id === lastSeenNotificationId) return
            lastSeenNotificationId = notification.id

            toast(`${notification.title}`, {
              description: notification.message || undefined,
              action: {
                label: 'Vezi',
                onClick: () => {
                  window.location.href = '/dashboard/notifications'
                },
              },
              duration: 6000,
            })
          }
        )
        .subscribe()
    }

    setupChannel()

    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase])

  return null
}
