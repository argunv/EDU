import { type Role } from '../types/user'

/** Домашний маршрут после входа / при несовпадении роли с маршрутом. */
export const ROLE_HOME: Record<Role, string> = {
  teacher: '/teacher/today',
  student: '/me/schedule',
  parent: '/me/schedule',
  admin: '/admin/classes',
  pending: '/pending',
  rejected: '/auth/login',
}
