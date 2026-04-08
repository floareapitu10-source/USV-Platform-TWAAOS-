import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar, 
  Users, 
  Bell, 
  Search, 
  MapPin, 
  Clock,
  GraduationCap,
  Music,
  Trophy,
  Briefcase,
  ArrowRight,
  Bot
} from "lucide-react"

const features = [
  {
    icon: Calendar,
    title: "Calendar Interactiv",
    description: "Vizualizeaza toate evenimentele intr-un calendar lunar sau saptamanal"
  },
  {
    icon: Bell,
    title: "Notificari Personalizate",
    description: "Primeste alerte pentru evenimentele care te intereseaza"
  },
  {
    icon: Search,
    title: "Cautare Avansata",
    description: "Filtreaza dupa categorie, data, locatie sau organizator"
  },
  {
    icon: Users,
    title: "Inscriee Rapida",
    description: "Inregistreaza-te la evenimente cu un singur click"
  },
  {
    icon: Bot,
    title: "AI Scraping",
    description: "Evenimente importate automat din surse locale"
  },
  {
    icon: MapPin,
    title: "Locatii USV",
    description: "Toate locatiile campusului intr-un singur loc"
  }
]

const categories = [
  { icon: GraduationCap, name: "Academic", color: "bg-blue-500" },
  { icon: Music, name: "Cultural", color: "bg-pink-500" },
  { icon: Trophy, name: "Sport", color: "bg-green-500" },
  { icon: Briefcase, name: "Cariera", color: "bg-purple-500" },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/usvlogo.png" alt="USV" className="h-6 w-6" />
            <span className="text-xl font-bold">USV Events</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Functionalitati
            </Link>
            <Link href="#categories" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Categorii
            </Link>
            <Link href="/auth/login">
              <Button variant="ghost">Autentificare</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>Inregistrare</Button>
            </Link>
          </nav>
          <div className="md:hidden flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button size="sm">Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container text-center">
          <Badge variant="secondary" className="mb-4">
            Platforma de evenimente USV
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance mb-6">
            Descopera toate evenimentele
            <span className="text-primary block">Universitatii Stefan cel Mare</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty">
            Platforma centralizata pentru gestionarea si vizualizarea evenimentelor 
            universitare. Calendar interactiv, notificari personalizate si multe altele.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/sign-up">
              <Button size="lg" className="gap-2">
                Incepe acum
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/events">
              <Button size="lg" variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                Vezi evenimentele
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/50">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">500+</div>
              <div className="text-sm text-muted-foreground">Evenimente/an</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">10k+</div>
              <div className="text-sm text-muted-foreground">Utilizatori</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">7</div>
              <div className="text-sm text-muted-foreground">Categorii</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">24/7</div>
              <div className="text-sm text-muted-foreground">Disponibilitate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Functionalitati</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tot ce ai nevoie pentru a ramane la curent cu evenimentele universitare
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section id="categories" className="py-20 bg-muted/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Categorii de evenimente</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Abone-te la categoriile care te intereseaza si primeste notificari
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {categories.map((category) => (
              <Card key={category.name} className="text-center hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className={`h-12 w-12 rounded-full ${category.color} flex items-center justify-center mx-auto mb-3`}>
                    <category.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium">{category.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Gata sa incepi?</h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
                Creeaza-ti un cont gratuit si descopera toate evenimentele 
                care au loc la Universitatea Stefan cel Mare din Suceava.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth/sign-up">
                  <Button size="lg" variant="secondary" className="gap-2">
                    Creeaza cont gratuit
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/usvlogo.png" alt="USV" className="h-6 w-6" />
                <span className="text-xl font-bold">USV Events</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Platforma de gestionare a evenimentelor pentru 
                Universitatea Stefan cel Mare din Suceava.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platforma</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/events" className="hover:text-foreground">Evenimente</Link></li>
                <li><Link href="/dashboard/calendar" className="hover:text-foreground">Calendar</Link></li>
                <li><Link href="/dashboard/subscriptions" className="hover:text-foreground">Abonamente</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Cont</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/auth/login" className="hover:text-foreground">Autentificare</Link></li>
                <li><Link href="/auth/sign-up" className="hover:text-foreground">Inregistrare</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Universitatea Stefan cel Mare</li>
                <li>Str. Universitatii 13</li>
                <li>720229 Suceava, Romania</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} USV Events. Proiect TWAAOS.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
