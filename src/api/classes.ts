import { api } from './client'
import type { ShiftType } from '../types/adminSchedule'
import { mapAdminClass, type RawAdminClass } from './contracts'

export type ClassItem = {
  id: string
  name: string
  yearStart?: number
  grade?: number
  letter?: string
  shift?: ShiftType
  shiftLocked?: boolean
  maxLessonsPerWeek?: number
  archived?: boolean
}

export async function getAdminClasses(options?: { includeArchived?: boolean }): Promise<ClassItem[]> {
  const params = options?.includeArchived ? { include_archived: 'true' } : {}
  const { data } = await api.get<RawAdminClass[]>('/admin/classes', { params })
  return data.map(mapAdminClass)
}
