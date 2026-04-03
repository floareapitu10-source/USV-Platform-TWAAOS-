import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Calendar, Mail } from 'lucide-react'

export default function SignUpSuccessPage() {
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
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Verifica email-ul</CardTitle>
              <CardDescription>
                Ti-am trimis un email de confirmare
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-6">
                Verifica casuta de email si apasa pe link-ul de confirmare pentru a-ti activa contul.
                Daca nu gasesti email-ul, verifica si folderul de spam.
              </p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline">
                  <Link href="/auth/login">Inapoi la autentificare</Link>
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
