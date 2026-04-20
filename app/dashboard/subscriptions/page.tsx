import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SubscriptionsList } from '@/components/subscriptions/subscriptions-list'
import { CategorySubscriptions } from '@/components/subscriptions/category-subscriptions'
import type { Category, Subscription, Profile } from '@/lib/types'
import { Heart } from 'lucide-react'

export default async function SubscriptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get all categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  // Get user's subscriptions
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)

  const typedCategories = (categories || []) as Category[]
  const typedSubscriptions = (subscriptions || []) as Subscription[]

  const categorySubscriptions: (Subscription & { category: Category | null; organizer: Profile | null })[] = typedSubscriptions
    .filter((s) => Boolean(s.category_id))
    .map((s) => ({
      ...s,
      category: s.category_id ? typedCategories.find((c) => c.id === s.category_id) || null : null,
      organizer: null,
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Abonamente</h1>
        <p className="text-muted-foreground">
          Aboneaza-te la categorii pentru a primi notificari despre evenimente noi
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Categorii disponibile</CardTitle>
            <CardDescription>
              Selecteaza categoriile la care vrei sa te abonezi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategorySubscriptions 
              categories={typedCategories} 
              subscriptions={categorySubscriptions}
              userId={user.id}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abonamentele mele</CardTitle>
            <CardDescription>
              Categoriile la care esti abonat
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categorySubscriptions.filter(s => s.category).length > 0 ? (
              <SubscriptionsList 
                subscriptions={categorySubscriptions.filter(s => s.category)} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Heart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nu ai niciun abonament activ
                </p>
                <p className="text-sm text-muted-foreground">
                  Selecteaza categorii din lista alaturata
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
