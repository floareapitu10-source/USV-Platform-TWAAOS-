'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import {
  Calendar,
  Home,
  Users,
  CalendarPlus,
  Bell,
  Settings,
  BarChart3,
  Heart,
  Globe,
  FolderOpen,
} from 'lucide-react'

interface DashboardSidebarProps {
  profile: Profile
}

const studentLinks = [
  { href: '/dashboard', label: 'Acasa', icon: Home },
  { href: '/dashboard/events', label: 'Evenimente', icon: Calendar },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarPlus },
  { href: '/dashboard/subscriptions', label: 'Abonamente', icon: Heart },
  { href: '/dashboard/notifications', label: 'Notificari', icon: Bell },
  { href: '/dashboard/settings', label: 'Setari', icon: Settings },
]

const organizerLinks = [
  { href: '/dashboard', label: 'Acasa', icon: Home },
  { href: '/dashboard/events', label: 'Evenimente', icon: Calendar },
  { href: '/dashboard/my-events', label: 'Evenimentele mele', icon: FolderOpen },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarPlus },
  { href: '/dashboard/notifications', label: 'Notificari', icon: Bell },
  { href: '/dashboard/settings', label: 'Setari', icon: Settings },
]

const adminLinks = [
  { href: '/dashboard', label: 'Acasa', icon: Home },
  { href: '/dashboard/events', label: 'Evenimente', icon: Calendar },
  { href: '/dashboard/my-events', label: 'Evenimentele mele', icon: FolderOpen },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarPlus },
  { href: '/dashboard/users', label: 'Utilizatori', icon: Users },
  { href: '/dashboard/stats', label: 'Statistici', icon: BarChart3 },
  { href: '/dashboard/scraping', label: 'AI Scraping', icon: Globe },
  { href: '/dashboard/notifications', label: 'Notificari', icon: Bell },
  { href: '/dashboard/settings', label: 'Setari', icon: Settings },
]

export function DashboardSidebar({ profile }: DashboardSidebarProps) {
  const pathname = usePathname()

  const links = profile.role === 'admin' 
    ? adminLinks 
    : profile.role === 'organizer' 
      ? organizerLinks 
      : studentLinks

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <img src="/usvlogo.png" alt="USV" className="h-6 w-6" />
        <span className="text-lg font-bold">USV Events</span>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href || 
              (link.href !== '/dashboard' && pathname.startsWith(link.href))
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t p-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">Conectat ca</p>
          <p className="text-sm font-medium truncate">{profile.full_name || profile.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
        </div>
      </div>
    </aside>
  )
}
