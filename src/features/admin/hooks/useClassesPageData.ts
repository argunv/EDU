import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  archiveAdminClass,
  createAdminClass,
  getAdminClasses,
  getAdminClassSubjects,
  patchAdminClass,
  type ClassItem,
} from '../../../api/admin'

export function useClassesPageData(includeArchived: boolean, selectedClassId: string | null) {
  const queryClient = useQueryClient()

  const classesQuery = useQuery({
    queryKey: ['admin', 'classes', includeArchived],
    queryFn: () => getAdminClasses({ includeArchived }),
  })

  const displayData = useMemo(() => {
    const data = classesQuery.data ?? []
    return includeArchived ? data.filter((c) => c.archived === true) : data
  }, [classesQuery.data, includeArchived])

  const selectedClass = useMemo(
    () => displayData.find((item) => item.id === selectedClassId),
    [displayData, selectedClassId],
  )

  const classSubjectsQuery = useQuery({
    queryKey: ['admin', 'subjects', selectedClass?.id],
    queryFn: () => getAdminClassSubjects(selectedClass!.id),
    enabled: Boolean(selectedClass?.id),
  })

  const createClassMutation = useMutation({
    mutationFn: createAdminClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] })
      toast.success('Класс создан')
    },
    onError: (err: Error) => toast.error(err.message || 'Не удалось создать класс'),
  })

  const patchClassMutation = useMutation({
    mutationFn: ({ classId, params }: { classId: string; params: { shift?: string; shiftLocked?: boolean; maxLessonsPerWeek?: number | null } }) =>
      patchAdminClass(classId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] })
      toast.success('Изменения сохранены')
    },
    onError: (err: Error) => toast.error(err.message || 'Не удалось сохранить'),
  })

  const archiveClassMutation = useMutation({
    mutationFn: (classId: string) => archiveAdminClass(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] })
      toast.success('Класс перемещён в архив')
    },
    onError: (err: Error) => toast.error(err.message || 'Не удалось архивировать'),
  })

  return {
    classesQuery,
    displayData,
    selectedClass,
    classSubjectsQuery,
    createClassMutation,
    patchClassMutation,
    archiveClassMutation,
  }
}

export type { ClassItem }
