'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface UserRoleSelectProps {
  userId: string
  currentRole: UserRole
  isCurrentUser: boolean
}

export function UserRoleSelect({ userId, currentRole, isCurrentUser }: UserRoleSelectProps) {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState(currentRole)
  const router = useRouter()

  const roleColors: Record<string, string> = {
    student: 'bg-blue-100 text-blue-800',
    organizer: 'bg-green-100 text-green-800',
    admin: 'bg-purple-100 text-purple-800',
  }

  const roleLabels: Record<string, string> = {
    student: 'Student',
    organizer: 'Organizator',
    admin: 'Admin',
  }

  const handleRoleChange = async (newRole: UserRole) => {
    if (isCurrentUser) return
    
    const supabase = createClient()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      setRole(newRole)
      router.refresh()
    } catch (error) {
      console.error('Error updating role:', error)
    } finally {
      setLoading(false)
    }
  }

  if (isCurrentUser) {
    return (
      <Badge className={roleColors[role]}>
        {roleLabels[role]} (Tu)
      </Badge>
    )
  }

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin" />
  }

  return (
    <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
      <SelectTrigger className="w-[130px]">
        <SelectValue>
          <Badge className={roleColors[role]}>
            {roleLabels[role]}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="student">Student</SelectItem>
        <SelectItem value="organizer">Organizator</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  )
}
