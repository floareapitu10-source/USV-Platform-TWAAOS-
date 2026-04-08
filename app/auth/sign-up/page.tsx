'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [faculty, setFaculty] = useState('')
  const [yearOfStudy, setYearOfStudy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError('Parolele nu coincid')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Parola trebuie sa aiba cel putin 6 caractere')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            role: 'student',
            faculty: faculty || null,
            year_of_study: yearOfStudy ? parseInt(yearOfStudy) : null,
          },
        },
      })
      if (error) throw error
      router.push('/auth/sign-up-success')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'A aparut o eroare')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2 text-primary">
            <img src="/usvlogo.png" alt="USV" className="h-8 w-8" />
            <span className="text-2xl font-bold">USV Events</span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Inregistrare</CardTitle>
              <CardDescription>Creeaza un cont nou de student</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Nume complet</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Ion Popescu"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@student.usv.ro"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="faculty">Facultate (optional)</Label>
                    <Select value={faculty} onValueChange={setFaculty}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteaza facultatea" />
                      </SelectTrigger>
                      <SelectContent>
                        {FACULTIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="yearOfStudy">Anul de studiu (optional)</Label>
                    <Select value={yearOfStudy} onValueChange={setYearOfStudy}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteaza anul" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            Anul {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Parola</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="repeat-password">Confirma parola</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      required
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Se creeaza contul...' : 'Inregistrare'}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  Ai deja cont?{' '}
                  <Link
                    href="/auth/login"
                    className="underline underline-offset-4"
                  >
                    Conecteaza-te
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
