"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Bot, Plus, Play, Loader2, RefreshCw, Trash2, ExternalLink } from "lucide-react"
import type { ScrapedSource, ScrapeLog } from "@/lib/types"

export default function ScrapingPage() {
  const [sources, setSources] = useState<ScrapedSource[]>([])
  const [logs, setLogs] = useState<ScrapeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSource, setNewSource] = useState({ name: "", url: "" })
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [sourcesRes, logsRes] = await Promise.all([
      supabase.from("scraped_sources").select("*").order("created_at", { ascending: false }),
      supabase.from("scrape_logs").select("*, scraped_sources(name)").order("created_at", { ascending: false }).limit(20)
    ])
    
    if (sourcesRes.data) setSources(sourcesRes.data)
    if (logsRes.data) setLogs(logsRes.data)
    setLoading(false)
  }

  async function handleScrape(sourceId: string) {
    setScraping(sourceId)
    setErrorMessage(null)
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId })
      })
      
      if (!response.ok) {
        const text = await response.text()
        const message = `Scraping failed (${response.status}): ${text}`
        setErrorMessage(message)
        throw new Error(message)
      }
      
      await fetchData()
    } catch (error) {
      console.error("Scraping error:", error)
    } finally {
      setScraping(null)
    }
  }

  async function handleScrapeAll() {
    setScraping("all")
    setErrorMessage(null)
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrape_all: true })
      })
      
      if (!response.ok) {
        const text = await response.text()
        const message = `Scraping failed (${response.status}): ${text}`
        setErrorMessage(message)
        throw new Error(message)
      }
      
      await fetchData()
    } catch (error) {
      console.error("Scraping error:", error)
    } finally {
      setScraping(null)
    }
  }

  async function toggleSourceActive(id: string, isActive: boolean) {
    await supabase.from("scraped_sources").update({ is_active: isActive }).eq("id", id)
    setSources(sources.map(s => s.id === id ? { ...s, is_active: isActive } : s))
  }

  async function addSource() {
    if (!newSource.name || !newSource.url) return
    
    const { data, error } = await supabase
      .from("scraped_sources")
      .insert({ name: newSource.name, url: newSource.url })
      .select()
      .single()
    
    if (data && !error) {
      setSources([data, ...sources])
      setNewSource({ name: "", url: "" })
      setIsDialogOpen(false)
    }
  }

  async function deleteSource(id: string) {
    await supabase.from("scraped_sources").delete().eq("id", id)
    setSources(sources.filter(s => s.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Event Scraping</h1>
          <p className="text-muted-foreground">
            Extrage automat evenimente din surse locale folosind AI
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleScrapeAll}
            disabled={scraping !== null}
          >
            {scraping === "all" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Scrape Toate
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adauga Sursa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adauga Sursa Noua</DialogTitle>
                <DialogDescription>
                  Adauga un nou site pentru scraping automat de evenimente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nume</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Primaria Suceava"
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com/evenimente"
                    value={newSource.url}
                    onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Anuleaza
                </Button>
                <Button onClick={addSource}>Adauga</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {errorMessage && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive break-words">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Surse Active
            </CardTitle>
            <CardDescription>
              Site-uri configurate pentru scraping automat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nu exista surse configurate
                </p>
              ) : (
                sources.map((source) => (
                  <div 
                    key={source.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{source.name}</h4>
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {source.url}
                      </p>
                      {source.last_scraped_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Ultima scanare: {new Date(source.last_scraped_at).toLocaleString("ro-RO")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={source.is_active}
                        onCheckedChange={(checked) => toggleSourceActive(source.id, checked)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleScrape(source.id)}
                        disabled={scraping !== null}
                      >
                        {scraping === source.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteSource(source.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Istoric Scanari</CardTitle>
            <CardDescription>
              Ultimele 20 de operatiuni de scraping
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sursa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rezultat</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nu exista inregistrari
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {(log as any).scraped_sources?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            log.status === "success" ? "default" : 
                            log.status === "partial" ? "secondary" : 
                            "destructive"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const m = (log.error_message || '').match(/updated=(\d+)/)
                          const updated = m ? Number(m[1]) : 0
                          return (
                            <span>
                              {log.events_added}/{log.events_found} adaugate
                              {updated > 0 ? ` (+${updated} actualizate)` : ''}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("ro-RO")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
