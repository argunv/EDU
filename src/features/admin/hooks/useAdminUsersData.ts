import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getAdminClasses } from '../../../api/admin'
import { getAdminAllUsers, getAdminPendingUsers, rejectAdminUser } from '../../../api/adminUsers'
import type { ApprovedRole, AdminUser } from '../../../types/user'

function matchesSearch(user: { name: string; email?: string | null }, q: string): boolean {
  const trimmed = q.trim().toLowerCase()
  if (!trimmed) return true
  const nameMatch = (user.name ?? '').toLowerCase().includes(trimmed)
  const emailMatch = (user.email ?? '').toLowerCase().includes(trimmed)
  return nameMatch || emailMatch
}

export function useAdminUsersData(searchQuery: string, roleFilter: '' | ApprovedRole) {
  const queryClient = useQueryClient()
  const pendingQuery = useQuery({ queryKey: ['admin', 'users', 'pending'], queryFn: getAdminPendingUsers })
  const allQuery = useQuery({ queryKey: ['admin', 'users', 'all'], queryFn: getAdminAllUsers })
  const classesQuery = useQuery({ queryKey: ['admin', 'classes'], queryFn: () => getAdminClasses() })

  const rejectMutation = useMutation({
    mutationFn: rejectAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Заявка отклонена')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const classById = useMemo(() => {
    const m: Record<string, string> = {}
    ;(classesQuery.data ?? []).forEach((c) => {
      m[c.id] = c.name
    })
    return m
  }, [classesQuery.data])

  const pendingFiltered = useMemo(
    () => (pendingQuery.data ?? []).filter((u) => matchesSearch(u, searchQuery)),
    [pendingQuery.data, searchQuery],
  )

  const allFiltered = useMemo(
    () =>
      (allQuery.data ?? []).filter((u: AdminUser) => {
        if (!matchesSearch(u, searchQuery)) return false
        if (roleFilter && u.role !== roleFilter) return false
        return true
      }),
    [allQuery.data, searchQuery, roleFilter],
  )

  return { pendingQuery, allQuery, rejectMutation, classById, pendingFiltered, allFiltered }
}
