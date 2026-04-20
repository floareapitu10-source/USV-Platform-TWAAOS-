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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Chrome } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'A aparut o eroare')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const url = new URL(window.location.origin)
      if (url.hostname === '0.0.0.0') {
        url.hostname = 'localhost'
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${url.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'A aparut o eroare la autentificarea cu Google')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2 text-primary">
            <img src="/usvlogo.png" alt="USV" className="h-8 w-8" />
            <span className="text-2xl font-bold">USV Events</span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Autentificare</CardTitle>
              <CardDescription className='text-center'>
                Alege metoda de autentificare
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                {/* Student Login - Google OAuth */}
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Studenti USV</p>
                    <p className="text-xs text-muted-foreground">Autentificare cu contul universitar (@student.usv.ro)</p>
                  </div>
                  <Button 
                    onClick={handleGoogleLogin} 
                    className="w-full" 
                    variant="outline"
                    disabled={isLoading}
                  >
                    <Chrome className="mr-2 h-4 w-4" />
                    {isLoading ? 'Se conecteaza...' : 'Conectare cu Google'}
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Sau
                    </span>
                  </div>
                </div>

                {/* Organizer/Admin Login - Email/Password */}
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Organizatori & Administratori</p>
                    <p className="text-xs text-muted-foreground">Autentificare cu email si parola</p>
                  </div>
                  <form onSubmit={handleLogin}>
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="organizator@exemplu.ro"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
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
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Se conecteaza...' : 'Conectare'}
                      </Button>
                    </div>
                  </form>
                </div>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}
                
                <div className="mt-4 text-center text-sm">
                  Nu ai cont?{' '}
                  <Link
                    href="/auth/sign-up"
                    className="underline underline-offset-4"
                  >
                    Inregistreaza-te
                  </Link>
                </div>
                <div className="mt-2 text-center text-sm">
                  <Link
                    href="/"
                    className="text-muted-foreground hover:underline"
                  >
                    Inapoi la pagina principala
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
