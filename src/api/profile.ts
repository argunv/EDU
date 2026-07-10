import { api } from './client'
import type { ChangePasswordPayload, Profile, ProfileUpdatePayload } from '../types/profile'

type RawProfileChild = {
  id: string
  name: string
  class_name: string
  avatar_url?: string | null
}
type RawProfileAssignment = { class_name: string; subject_name: string }
type RawProfile = {
  id: string
  name: string
  role: Profile['role']
  email?: string | null
  phone?: string | null
  birth_date?: string | null
  created_at: string
  last_login_at?: string | null
  avatar_url?: string | null
  class_name?: string | null
  parent_names?: string[] | null
  children?: RawProfileChild[] | null
  assignments?: RawProfileAssignment[] | null
}

function mapProfile(raw: RawProfile): Profile {
  return {
    id: raw.id,
    name: raw.name,
    role: raw.role,
    ...(raw.email ? { email: raw.email } : {}),
    ...(raw.phone ? { phone: raw.phone } : {}),
    ...(raw.birth_date ? { birthDate: raw.birth_date } : {}),
    createdAt: raw.created_at,
    ...(raw.last_login_at ? { lastLoginAt: raw.last_login_at } : {}),
    ...(raw.avatar_url ? { avatarUrl: raw.avatar_url } : {}),
    ...(raw.class_name ? { className: raw.class_name } : {}),
    ...(raw.parent_names?.length ? { parentNames: raw.parent_names } : {}),
    ...(raw.children?.length
      ? {
          children: raw.children.map((c) => ({
            id: c.id,
            name: c.name,
            className: c.class_name,
            ...(c.avatar_url ? { avatarUrl: c.avatar_url } : {}),
          })),
        }
      : {}),
    ...(raw.assignments?.length
      ? {
          assignments: raw.assignments.map((a) => ({
            className: a.class_name,
            subjectName: a.subject_name,
          })),
        }
      : {}),
  }
}

export async function getMyProfile(): Promise<Profile> {
  const { data } = await api.get<RawProfile>('/me/profile')
  return mapProfile(data)
}

export async function updateMyProfile(payload: ProfileUpdatePayload): Promise<Profile> {
  const body: Record<string, string | null> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.phone !== undefined) body.phone = payload.phone
  if (payload.birthDate !== undefined) body.birth_date = payload.birthDate
  const { data } = await api.patch<RawProfile>('/me/profile', body)
  return mapProfile(data)
}

export async function changeMyPassword(payload: ChangePasswordPayload): Promise<void> {
  await api.post('/me/change-password', {
    current_password: payload.currentPassword,
    new_password: payload.newPassword,
  })
}

export async function uploadMyAvatar(file: File): Promise<Profile> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<RawProfile>('/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return mapProfile(data)
}

export async function deleteMyAvatar(): Promise<Profile> {
  const { data } = await api.delete<RawProfile>('/me/avatar')
  return mapProfile(data)
}
