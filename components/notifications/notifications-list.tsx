'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Notification, Event } from '@/lib/types'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { Bell, Calendar, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NotificationsListProps {
  notifications: (Notification & { event: Event | null })[]
  userId: string
}

const notificationIcons: Record<string, typeof Bell> = {
  new_event: Calendar,
  event_update: Info,
  event_reminder: Bell,
  registration_confirmed: CheckCircle,
  event_cancelled: AlertCircle,
}

const notificationColors: Record<string, string> = {
  new_event: 'text-primary',
  event_update: 'text-blue-500',
  event_reminder: 'text-yellow-500',
  registration_confirmed: 'text-green-500',
  event_cancelled: 'text-destructive',
}

export function NotificationsList({ notifications, userId }: NotificationsListProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const router = useRouter()

  const handleMarkAsRead = async (notificationId: string) => {
    const supabase = createClient()
    setLoading(notificationId)

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)

      router.refresh()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    } finally {
      setLoading(null)
    }
  }

  const handleMarkAllAsRead = async () => {
    const supabase = createClient()
    setMarkingAll(true)

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      router.refresh()
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Marcheaza toate ca citite
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((notification) => {
          const Icon = notificationIcons[notification.type] || Bell
          const colorClass = notificationColors[notification.type] || 'text-muted-foreground'
          const isLoading = loading === notification.id

          return (
            <div
              key={notification.id}
              className={cn(
                'flex items-start gap-4 p-4 rounded-lg border transition-colors',
                !notification.is_read && 'bg-primary/5 border-primary/20'
              )}
            >
              <div className={cn('mt-1', colorClass)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{notification.title}</p>
                    {notification.message && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(notification.created_at), "d MMMM yyyy 'la' HH:mm", { locale: ro })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <Badge variant="default" className="shrink-0">Nou</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {notification.event && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/events/${notification.event.id}`}>
                        Vezi evenimentul
                      </Link>
                    </Button>
                  )}
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(notification.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Marcheaza ca citit'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
