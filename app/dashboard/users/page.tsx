import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Profile } from '@/lib/types'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { Users } from 'lucide-react'
import { UserRoleSelect } from '@/components/admin/user-role-select'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const typedUsers = (users || []) as Profile[]

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Utilizatori</h1>
        <p className="text-muted-foreground">
          Gestioneaza utilizatorii platformei
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toti utilizatorii</CardTitle>
          <CardDescription>
            {typedUsers.length} utilizatori inregistrati
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typedUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Facultate</TableHead>
                  <TableHead>Data inregistrarii</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typedUsers.map((userProfile) => (
                  <TableRow key={userProfile.id}>
                    <TableCell className="font-medium">
                      {userProfile.full_name || '-'}
                    </TableCell>
                    <TableCell>{userProfile.email}</TableCell>
                    <TableCell>{userProfile.faculty || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(userProfile.created_at), 'd MMM yyyy', { locale: ro })}
                    </TableCell>
                    <TableCell>
                      <UserRoleSelect 
                        userId={userProfile.id} 
                        currentRole={userProfile.role}
                        isCurrentUser={userProfile.id === user.id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Niciun utilizator</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
