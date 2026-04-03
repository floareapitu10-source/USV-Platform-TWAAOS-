import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationsList } from '@/components/notifications/notifications-list'
import type { Notification, Event } from '@/lib/types'
import { Bell } from 'lucide-react'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: notifications } = await supabase
    .from('notifications')
    .select(`
      *,
      event:events(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const typedNotifications = (notifications || []) as (Notification & { event: Event | null })[]

  const unreadCount = typedNotifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificari</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 
              ? `Ai ${unreadCount} notificari necitite`
              : 'Toate notificarile sunt citite'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toate notificarile</CardTitle>
        </CardHeader>
        <CardContent>
          {typedNotifications.length > 0 ? (
            <NotificationsList notifications={typedNotifications} userId={user.id} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nicio notificare</p>
              <p className="text-sm text-muted-foreground">
                Vei primi notificari despre evenimentele la care te-ai abonat
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
