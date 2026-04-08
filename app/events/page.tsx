"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { EventCard } from "@/components/events/event-card"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar, Search, Loader2 } from "lucide-react"
import Link from "next/link"
import type { Event, Category, Profile } from "@/lib/types"

export default function PublicEventsPage() {
  const [events, setEvents] = useState<(Event & { category: Category | null; organizer: Profile | null })[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedOrganizer, setSelectedOrganizer] = useState<string>("all")
  const [selectedMode, setSelectedMode] = useState<string>("all")
  const [operator, setOperator] = useState<'and' | 'or'>('and')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      
      try {
        // Fetch categories
        const { data: categoriesData, error: catError } = await supabase
          .from("categories")
          .select("*")
          .order("name")
        
        if (catError) {
          console.log("[v0] Categories error:", catError)
        } else {
          setCategories(categoriesData || [])
        }

        // Fetch events
        let query = supabase
          .from("events")
          .select(`
            *,
            category:categories(*),
            organizer:profiles(*)
          `)
          .eq("status", "published")
          .eq("is_public", true)
          .gte("start_date", new Date().toISOString())
          .order("start_date", { ascending: true })

        const { data: eventsData, error: eventsError } = await query

        if (eventsError) {
          console.log("[v0] Events error:", eventsError)
          setError(eventsError.message)
        } else {
          console.log("[v0] Events loaded:", eventsData?.length || 0)
          setEvents(eventsData || [])
        }
      } catch (err) {
        console.log("[v0] Fetch error:", err)
        setError("Eroare la incarcarea datelor")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredEvents = events.filter(event => {
    const matchesSearch =
      !search ||
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      Boolean(event.description?.toLowerCase().includes(search.toLowerCase()))
    
    const matchesCategory = selectedCategory === "all" || event.category_id === selectedCategory

    const matchesOrganizer = selectedOrganizer === 'all' || event.organizer_id === selectedOrganizer

    const matchesMode = selectedMode === 'all' || (event as any).participation_mode === selectedMode

    if (operator === 'or') {
      const activeChecks: boolean[] = []
      if (search) activeChecks.push(matchesSearch)
      if (selectedCategory !== 'all') activeChecks.push(matchesCategory)
      if (selectedOrganizer !== 'all') activeChecks.push(matchesOrganizer)
      if (selectedMode !== 'all') activeChecks.push(matchesMode)

      if (activeChecks.length === 0) return true
      return activeChecks.some(Boolean)
    }

    return matchesSearch && matchesCategory && matchesOrganizer && matchesMode
  })

  const organizers = Array.from(
    new Map(
      events
        .filter((e) => e.organizer_id)
        .map((e) => [e.organizer_id, { id: e.organizer_id, full_name: e.organizer?.full_name || null }])
    ).values()
  ).sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ro'))

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/usvlogo.png" alt="USV" className="h-6 w-6" />
            <span className="text-xl font-bold">USV Events</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Autentificare</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>Inregistrare</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Evenimente Universitare</h1>
          <p className="text-muted-foreground">
            Descopera toate evenimentele de la Universitatea Stefan cel Mare din Suceava
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cauta evenimente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={operator} onValueChange={(v) => setOperator(v as 'and' | 'or')}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="AND" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">AND</SelectItem>
              <SelectItem value="or">OR</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Toate categoriile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate categoriile</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedOrganizer} onValueChange={setSelectedOrganizer}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Toti organizatorii" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toti organizatorii</SelectItem>
              {organizers.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.full_name || o.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMode} onValueChange={setSelectedMode}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Participare" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate</SelectItem>
              <SelectItem value="in_person">Fizic</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="hybrid">Hibrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CardTitle className="text-lg mb-2 text-destructive">Eroare</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardContent>
          </Card>
        ) : filteredEvents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">Niciun eveniment gasit</CardTitle>
              <CardDescription>
                {search || selectedCategory !== "all" 
                  ? "Incearca sa modifici filtrele" 
                  : "Nu exista evenimente disponibile momentan"}
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
