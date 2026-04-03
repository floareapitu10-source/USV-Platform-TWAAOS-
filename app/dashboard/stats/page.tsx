import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, CalendarCheck, FolderOpen, TrendingUp } from 'lucide-react'
import { StatsCharts } from '@/components/admin/stats-charts'

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Get stats
  const [
    { count: totalEvents },
    { count: totalUsers },
    { count: totalRegistrations },
    { data: categories },
    { data: recentEvents },
  ] = await Promise.all([
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('status', 'registered'),
    supabase.from('categories').select('id, name'),
    supabase
      .from('events')
      .select('id, category_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // Get upcoming events count
  const { count: upcomingEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('start_date', new Date().toISOString())

  // Calculate events by category
  const eventsByCategory = (categories || []).map((cat) => ({
    category: cat.name,
    count: (recentEvents || []).filter((e) => e.category_id === cat.id).length,
  }))

  // Calculate events by month (last 6 months)
  const now = new Date()
  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const count = (recentEvents || []).filter((e) => {
      const date = new Date(e.created_at)
      return date >= month && date <= monthEnd
    }).length
    monthlyData.push({
      month: month.toLocaleDateString('ro-RO', { month: 'short' }),
      events: count,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Statistici</h1>
        <p className="text-muted-foreground">
          Privire de ansamblu asupra platformei
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total evenimente</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              evenimente create
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evenimente viitoare</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              programate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilizatori</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              conturi inregistrate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inscrieri</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations || 0}</div>
            <p className="text-xs text-muted-foreground">
              inscrieri active
            </p>
          </CardContent>
        </Card>
      </div>

      <StatsCharts 
        eventsByCategory={eventsByCategory}
        monthlyData={monthlyData}
      />
    </div>
  )
}
