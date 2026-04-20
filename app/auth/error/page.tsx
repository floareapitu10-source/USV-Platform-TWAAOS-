'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Calendar, AlertCircle, ShieldX } from 'lucide-react'
import { useEffect, useState, Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const errorType = searchParams.get('error')
    switch (errorType) {
      case 'domain_not_allowed':
        setError('domain_not_allowed')
        break
      case 'auth_failed':
        setError('auth_failed')
        break
      default:
        setError('generic')
    }
  }, [searchParams])

  const getErrorContent = () => {
    switch (error) {
      case 'domain_not_allowed':
        return {
          title: 'Domeniu neautorizat',
          description: 'Doar conturile @student.usv.ro sunt permise pentru autentificarea cu Google.',
          message: 'Te rugam sa folosesti contul universitar sau sa te autentifici ca organizator.',
          icon: ShieldX
        }
      case 'auth_failed':
        return {
          title: 'Autentificare esuata',
          description: 'A aparut o eroare la autentificarea cu Google.',
          message: 'Te rugam sa incerci din nou sau sa contactezi suportul.',
          icon: AlertCircle
        }
      default:
        return {
          title: 'Eroare de autentificare',
          description: 'A aparut o problema la autentificare.',
          message: 'Link-ul de confirmare poate fi expirat sau invalid. Te rugam sa incerci din nou.',
          icon: AlertCircle
        }
    }
  }

  const content = getErrorContent()
  const Icon = content.icon

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Calendar className="h-8 w-8" />
            <span className="text-2xl font-bold">USV Events</span>
          </div>
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <Icon className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">{content.title}</CardTitle>
              <CardDescription>
                {content.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-6">
                {content.message}
              </p>
              <div className="flex flex-col gap-2">
                <Button asChild>
                  <Link href="/auth/login">Incearca din nou</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/">Pagina principala</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  )
}
