'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Category, Event, EventStatus, ParticipationMode } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EventFormProps {
  categories: Category[]
  organizerId: string
  event?: Event
}

export function EventForm({ categories, organizerId, event }: EventFormProps) {
  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState(event?.description || '')
  const [shortDescription, setShortDescription] = useState(event?.short_description || '')
  const [location, setLocation] = useState(event?.location || '')
  const [locationDetails, setLocationDetails] = useState(event?.location_details || '')
  const [participationMode, setParticipationMode] = useState<ParticipationMode | '__none__'>(
    (event?.participation_mode as ParticipationMode | null) || '__none__'
  )
  const [startDate, setStartDate] = useState(event?.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : '')
  const [endDate, setEndDate] = useState(event?.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : '')
  const [categoryId, setCategoryId] = useState(event?.category_id || '__none__')
  const [maxParticipants, setMaxParticipants] = useState(event?.max_participants?.toString() || '')
  const [isPublic, setIsPublic] = useState(event?.is_public ?? true)
  const [isFeatured, setIsFeatured] = useState(event?.is_featured ?? false)
  const [status, setStatus] = useState<EventStatus>(event?.status || 'draft')
  const [registrationDeadline, setRegistrationDeadline] = useState(
    event?.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : ''
  )
  const [imageUrl, setImageUrl] = useState(event?.image_url || '')
  const [externalUrl, setExternalUrl] = useState(event?.external_url || '')
  const [tags, setTags] = useState(event?.tags?.join(', ') || '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setLoading(true)
    setError(null)

    try {
      const eventData = {
        title,
        description: description || null,
        short_description: shortDescription || null,
        location: location || null,
        location_details: locationDetails || null,
        participation_mode: participationMode === '__none__' ? null : participationMode,
        start_date: new Date(startDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null,
        category_id: categoryId === '__none__' ? null : categoryId,
        organizer_id: organizerId,
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
        is_public: isPublic,
        is_featured: isFeatured,
        status,
        registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
        image_url: imageUrl || null,
        external_url: externalUrl || null,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        updated_at: new Date().toISOString(),
      }

      if (event) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('events')
          .insert(eventData)

        if (error) throw error
      }

      router.push('/dashboard/my-events')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A aparut o eroare')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Titlu *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titlul evenimentului"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="shortDescription">Descriere scurta</Label>
          <Input
            id="shortDescription"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="O descriere scurta pentru listari"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Descriere completa</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descriere detaliata a evenimentului"
            rows={5}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="startDate">Data si ora inceperii *</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endDate">Data si ora incheierii</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="location">Locatie</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Aula Magna USV"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="locationDetails">Detalii locatie</Label>
            <Input
              id="locationDetails"
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
              placeholder="Ex: Etaj 2, Sala A201"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="participationMode">Modalitate participare</Label>
          <Select value={participationMode} onValueChange={(v) => setParticipationMode(v as ParticipationMode | '__none__')}>
            <SelectTrigger>
              <SelectValue placeholder="Selecteaza" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nespecificat</SelectItem>
              <SelectItem value="in_person">Fizic</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="hybrid">Hibrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="category">Categorie</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteaza categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Fara categorie</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="maxParticipants">Nr. maxim participanti</Label>
            <Input
              id="maxParticipants"
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder="Nelimitat"
              min="1"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="registrationDeadline">Termen limita inscriere</Label>
          <Input
            id="registrationDeadline"
            type="datetime-local"
            value={registrationDeadline}
            onChange={(e) => setRegistrationDeadline(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="imageUrl">URL imagine</Label>
            <Input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="externalUrl">Link extern</Label>
            <Input
              id="externalUrl"
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tags">Etichete (separate prin virgula)</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="workshop, programare, AI"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as EventStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Ciorna</SelectItem>
              <SelectItem value="published">Publicat</SelectItem>
              <SelectItem value="cancelled">Anulat</SelectItem>
              <SelectItem value="completed">Incheiat</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Eveniment public</Label>
            <p className="text-sm text-muted-foreground">
              Evenimentul va fi vizibil pentru toti utilizatorii
            </p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Eveniment recomandat</Label>
            <p className="text-sm text-muted-foreground">
              Va aparea in sectiunea de evenimente recomandate
            </p>
          </div>
          <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Se salveaza...
            </>
          ) : event ? (
            'Actualizeaza evenimentul'
          ) : (
            'Creeaza evenimentul'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Anuleaza
        </Button>
      </div>
    </form>
  )
}
