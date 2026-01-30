import { api } from './client'
import type { AdminUser, ApprovedRole } from '../types/user'

export type StudentOption = { id: string; name: string; className: string }
export type SubjectOption = { id: string; name: string }

export async function getAdminAllStudents(): Promise<StudentOption[]> {
  const { data } = await api.get<Array<{ id: string; name: string; class_name: string }>>('/students')
  return data.map((s) => ({ id: s.id, name: s.name, className: s.class_name ?? '' }))
}

export async function getAdminAllSubjects(): Promise<SubjectOption[]> {
  const { data } = await api.get<Array<{ id: string; name: string }>>('/admin/subjects')
  return data.map((s) => ({ id: s.id, name: s.name }))
}

function mapAdminUser(u: {
  id: string
  name: string
  role: string
  email?: string
  created_at?: string
  class_id?: string
  child_ids?: string[]
  class_ids?: string[]
  subject_ids?: string[]
}): AdminUser {
  return {
    id: u.id,
    name: u.name,
    role: u.role as AdminUser['role'],
    email: u.email,
    createdAt: u.created_at ?? new Date().toISOString(),
    classId: u.class_id,
    childIds: u.child_ids,
    classIds: u.class_ids,
    subjectIds: u.subject_ids,
  }
}

export async function getAdminPendingUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<unknown[]>('/admin/users', { params: { status: 'pending' } })
  return (data as Array<Record<string, unknown>>).map((u) =>
    mapAdminUser({
      id: String(u.id),
      name: String(u.name),
      role: String(u.role),
      email: u.email != null ? String(u.email) : undefined,
      created_at: u.created_at != null ? String(u.created_at) : undefined,
      class_id: u.class_id != null ? String(u.class_id) : undefined,
      child_ids: Array.isArray(u.child_ids) ? u.child_ids.map(String) : undefined,
      class_ids: Array.isArray(u.class_ids) ? u.class_ids.map(String) : undefined,
      subject_ids: Array.isArray(u.subject_ids) ? u.subject_ids.map(String) : undefined,
    })
  )
}

export async function getAdminAllUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<unknown[]>('/admin/users')
  return (data as Array<Record<string, unknown>>).map((u) =>
    mapAdminUser({
      id: String(u.id),
      name: String(u.name),
      role: String(u.role),
      email: u.email != null ? String(u.email) : undefined,
      created_at: u.created_at != null ? String(u.created_at) : undefined,
      class_id: u.class_id != null ? String(u.class_id) : undefined,
      child_ids: Array.isArray(u.child_ids) ? u.child_ids.map(String) : undefined,
      class_ids: Array.isArray(u.class_ids) ? u.class_ids.map(String) : undefined,
      subject_ids: Array.isArray(u.subject_ids) ? u.subject_ids.map(String) : undefined,
    })
  )
}

export type ApprovePayload = {
  role: ApprovedRole
  classId?: string
  childIds?: string[]
  classIds?: string[]
  subjectIds?: string[]
}

export async function approveAdminUser(userId: string, payload: ApprovePayload): Promise<void> {
  await api.post(`/admin/users/${userId}/approve`, {
    role: payload.role,
    class_id: payload.classId,
    child_ids: payload.childIds,
    class_ids: payload.classIds,
    subject_ids: payload.subjectIds,
  })
}

export async function rejectAdminUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/reject`)
}

/** Изменить роль/класс уже одобренного пользователя (student/teacher/parent) */
export async function patchAdminUserRole(userId: string, payload: ApprovePayload): Promise<void> {
  await api.patch(`/admin/users/${userId}/role`, {
    role: payload.role,
    class_id: payload.classId ?? null,
    child_ids: payload.childIds ?? null,
    class_ids: payload.classIds ?? null,
    subject_ids: payload.subjectIds ?? null,
  })
}
