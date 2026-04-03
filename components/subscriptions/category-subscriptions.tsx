'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Category, Subscription, Profile } from '@/lib/types'
import { Heart, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface CategorySubscriptionsProps {
  categories: Category[]
  subscriptions: (Subscription & { category: Category | null; organizer: Profile | null })[]
  userId: string
}

export function CategorySubscriptions({ categories, subscriptions, userId }: CategorySubscriptionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const subscribedCategoryIds = subscriptions
    .filter(s => s.category)
    .map(s => s.category_id)

  const handleToggleSubscription = async (categoryId: string) => {
    const supabase = createClient()
    setLoading(categoryId)

    try {
      const isSubscribed = subscribedCategoryIds.includes(categoryId)

      if (isSubscribed) {
        await supabase
          .from('subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('category_id', categoryId)
      } else {
        await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            category_id: categoryId,
          })
      }

      router.refresh()
    } catch (error) {
      console.error('Subscription error:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2">
      {categories.map((category) => {
        const isSubscribed = subscribedCategoryIds.includes(category.id)
        const isLoading = loading === category.id

        return (
          <div
            key={category.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border transition-colors',
              isSubscribed && 'bg-primary/5 border-primary/20'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <div>
                <p className="font-medium">{category.name}</p>
                {category.description && (
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                )}
              </div>
            </div>
            <Button
              variant={isSubscribed ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleToggleSubscription(category.id)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSubscribed ? (
                <>
                  <Heart className="h-4 w-4 mr-1 fill-current" />
                  Abonat
                </>
              ) : (
                <>
                  <Heart className="h-4 w-4 mr-1" />
                  Aboneaza-te
                </>
              )}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
