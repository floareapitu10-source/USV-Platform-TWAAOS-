'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EventRegistration, Profile } from '@/lib/types'
import { Download } from 'lucide-react'
import { format } from 'date-fns'

interface ExportButtonProps {
  registrations: (EventRegistration & { user: Profile })[]
  eventTitle: string
}

export function ExportButton({ registrations, eventTitle }: ExportButtonProps) {
  const exportToCSV = () => {
    const headers = ['Nume', 'Email', 'Facultate', 'An studiu', 'Telefon', 'Data inscrierii', 'Status']
    const rows = registrations.map((r) => [
      r.user?.full_name || '',
      r.user?.email || '',
      r.user?.faculty || '',
      r.user?.year_of_study?.toString() || '',
      r.user?.phone || '',
      format(new Date(r.registered_at), 'yyyy-MM-dd HH:mm'),
      r.status,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_')}_inscrieri.csv`
    link.click()
  }

  const exportToJSON = () => {
    const data = registrations.map((r) => ({
      nume: r.user?.full_name || '',
      email: r.user?.email || '',
      facultate: r.user?.faculty || '',
      an_studiu: r.user?.year_of_study || null,
      telefon: r.user?.phone || '',
      data_inscriere: r.registered_at,
      status: r.status,
    }))

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_')}_inscrieri.json`
    link.click()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exporta
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToCSV}>
          Exporta ca CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON}>
          Exporta ca JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
