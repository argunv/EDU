export type ProfileChild = {
  id: string
  name: string
  className: string
  avatarUrl?: string
}

export type ProfileAssignment = {
  className: string
  subjectName: string
}

export type Profile = {
  id: string
  name: string
  role: 'teacher' | 'student' | 'parent' | 'admin'
  email?: string
  phone?: string
  birthDate?: string
  createdAt: string
  lastLoginAt?: string
  avatarUrl?: string
  className?: string
  parentNames?: string[]
  children?: ProfileChild[]
  assignments?: ProfileAssignment[]
}

export type ProfileUpdatePayload = {
  name?: string
  phone?: string
  birthDate?: string | null
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
}
