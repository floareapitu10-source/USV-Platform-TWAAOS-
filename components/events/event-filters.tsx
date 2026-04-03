'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Category } from '@/lib/types'
import { Search, X } from 'lucide-react'
import { useCallback, useState } from 'react'

interface EventFiltersProps {
  categories: Category[]
}

export function EventFilters({ categories }: EventFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }
      return params.toString()
    },
    [searchParams]
  )

  const handleSearch = () => {
    router.push(`/dashboard/events?${createQueryString('search', search)}`)
  }

  const handleCategoryChange = (value: string) => {
    router.push(`/dashboard/events?${createQueryString('category', value === 'all' ? '' : value)}`)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/dashboard/events?${createQueryString('date', e.target.value)}`)
  }

  const clearFilters = () => {
    setSearch('')
    router.push('/dashboard/events')
  }

  const hasFilters = searchParams.get('search') || searchParams.get('category') || searchParams.get('date')

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-2">
        <Input
          placeholder="Cauta evenimente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-sm"
        />
        <Button onClick={handleSearch} variant="secondary">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Select
          value={searchParams.get('category') || 'all'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate categoriile</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={searchParams.get('date') || ''}
          onChange={handleDateChange}
          className="w-[180px]"
        />

        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Sterge filtre
          </Button>
        )}
      </div>
    </div>
  )
}
