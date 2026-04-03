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
    const matchesSearch = !search || 
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.description?.toLowerCase().includes(search.toLowerCase())
    
    const matchesCategory = selectedCategory === "all" || event.category_id === selectedCategory

    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
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
