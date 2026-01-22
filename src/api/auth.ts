import { api, mapUserResponse } from './client'
import type { User } from '../types/user'

export type LoginCredentials = {
  login: string
  password: string
}

export type LoginResponse = {
  accessToken: string
  user: User
}

export type RegisterPayload = {
  name: string
  email: string
  password: string
}

export type RegisterResponse = {
  accessToken: string
  user: User
}

export type ForgotPasswordPayload = { email: string }
export type ForgotPasswordResponse = { ok: true }
export type ResetPasswordPayload = { token: string; password: string }
export type ResetPasswordResponse = { ok: true }

export async function apiLogin(credentials: LoginCredentials): Promise<LoginResponse> {
  const { data } = await api.post<{ access_token: string; user: User }>('/auth/login', credentials)
  return mapUserResponse(data)
}

export async function apiRegister(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post<{ access_token: string; user: User }>('/auth/register', payload)
  return mapUserResponse(data)
}

export async function apiForgotPassword(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
  await api.post('/auth/forgot-password', payload)
  return { ok: true }
}

export async function apiResetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
  await api.post('/auth/reset-password', payload)
  return { ok: true }
}

export async function apiLogout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function apiMe(): Promise<LoginResponse | null> {
  try {
    const { data } = await api.get<{ access_token: string; user: User }>('/auth/me')
    return mapUserResponse(data)
  } catch {
    return null
  }
}
