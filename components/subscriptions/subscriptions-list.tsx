'use client'

import { Badge } from '@/components/ui/badge'
import type { Category, Subscription, Profile } from '@/lib/types'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'

interface SubscriptionsListProps {
  subscriptions: (Subscription & { category: Category | null; organizer: Profile | null })[]
}

export function SubscriptionsList({ subscriptions }: SubscriptionsListProps) {
  return (
    <div className="space-y-2">
      {subscriptions.map((subscription) => (
        <div
          key={subscription.id}
          className="flex items-center justify-between p-3 rounded-lg border"
        >
          <div className="flex items-center gap-3">
            {subscription.category && (
              <>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: subscription.category.color }}
                />
                <div>
                  <p className="font-medium">{subscription.category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Abonat din {format(new Date(subscription.created_at), 'd MMMM yyyy', { locale: ro })}
                  </p>
                </div>
              </>
            )}
            {subscription.organizer && (
              <div>
                <p className="font-medium">{subscription.organizer.full_name}</p>
                <p className="text-xs text-muted-foreground">Organizator</p>
              </div>
            )}
          </div>
          <Badge variant="secondary">Activ</Badge>
        </div>
      ))}
    </div>
  )
}
