'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Profile } from '@/lib/types'
import { Loader2, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

const FACULTIES = [
  'Facultatea de Inginerie Electrica si Stiinta Calculatoarelor',
  'Facultatea de Inginerie Mecanica, Mecatronica si Management',
  'Facultatea de Inginerie Alimentara',
  'Facultatea de Silvicultura',
  'Facultatea de Stiinte Economice si Administratie Publica',
  'Facultatea de Litere si Stiinte ale Comunicarii',
  'Facultatea de Istorie si Geografie',
  'Facultatea de Educatie Fizica si Sport',
  'Facultatea de Drept si Stiinte Administrative',
  'Facultatea de Medicina si Stiinte Biologice',
]

interface ProfileFormProps {
  profile: Profile
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [faculty, setFaculty] = useState(profile.faculty || '')
  const [yearOfStudy, setYearOfStudy] = useState(profile.year_of_study?.toString() || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          faculty: faculty || null,
          year_of_study: yearOfStudy ? parseInt(yearOfStudy) : null,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (error) throw error

      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A aparut o eroare')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={profile.email}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Email-ul nu poate fi modificat
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="fullName">Nume complet</Label>
        <Input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ion Popescu"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="faculty">Facultate</Label>
        <Select value={faculty} onValueChange={setFaculty}>
          <SelectTrigger>
            <SelectValue placeholder="Selecteaza facultatea" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nicio selectie</SelectItem>
            {FACULTIES.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="yearOfStudy">Anul de studiu</Label>
        <Select value={yearOfStudy} onValueChange={setYearOfStudy}>
          <SelectTrigger>
            <SelectValue placeholder="Selecteaza anul" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nicio selectie</SelectItem>
            {[1, 2, 3, 4, 5, 6].map((year) => (
              <SelectItem key={year} value={year.toString()}>
                Anul {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="phone">Telefon</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0740123456"
        />
      </div>

      <div className="grid gap-2">
        <Label>Rol</Label>
        <Input
          value={profile.role === 'admin' ? 'Administrator' : profile.role === 'organizer' ? 'Organizator' : 'Student'}
          disabled
          className="bg-muted capitalize"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      
      {success && (
        <p className="text-sm text-green-600 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Profilul a fost actualizat cu succes
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Se salveaza...
          </>
        ) : (
          'Salveaza modificarile'
        )}
      </Button>
    </form>
  )
}
