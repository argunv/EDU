import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { z } from 'zod'
import type { User } from '../types/user'

// В prod и при dev с proxy используйте /api (один origin). Иначе — полный URL бэкенда.
const baseURL = import.meta.env.VITE_API_URL ?? '/api'

let getToken: (() => string | null) | null = null
let setToken: ((t: string) => void) | null = null
let setUser: ((u: User) => void) | null = null
let logoutCallback: (() => void) | null = null

export function configureAuth(config: {
  getToken: () => string | null
  setToken: (t: string) => void
  setUser: (u: User) => void
  logout: () => void
}) {
  getToken = config.getToken
  setToken = config.setToken
  setUser = config.setUser
  logoutCallback = config.logout
}

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken?.() ?? null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshing = false
let queue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = []

const rawUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['teacher', 'student', 'parent', 'admin', 'pending', 'rejected']),
  email: z.string().optional(),
  created_at: z.string().optional(),
  class_name: z.string().nullable().optional().transform((v) => v ?? undefined),
  parent_names: z.array(z.string()).nullable().optional().transform((v) => v ?? undefined),
})

const refreshSchema = z.object({
  access_token: z.string().optional(),
  accessToken: z.string().optional(),
  user: rawUserSchema.optional(),
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then(() => api(originalRequest))
      }
      originalRequest._retry = true
      refreshing = true
      try {
        const { data } = await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const parsed = refreshSchema.safeParse(data)
        if (!parsed.success) {
          throw new Error('Invalid refresh response format')
        }
        const accessToken = parsed.data.access_token ?? parsed.data.accessToken
        const user = parsed.data.user
        if (setToken && accessToken) setToken(accessToken)
        if (setUser && user) {
          setUser({
            id: user.id,
            name: user.name,
            role: user.role,
            ...(user.email ? { email: user.email } : {}),
            ...(user.class_name !== undefined && { className: user.class_name }),
            ...(user.parent_names !== undefined && { parentNames: user.parent_names }),
          })
        }
        queue.forEach((q) => q.resolve(undefined))
        queue = []
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        queue.forEach((q) => q.reject(refreshError))
        queue = []
        logoutCallback?.()
        return Promise.reject(refreshError)
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(error)
  }
)

type RawUser = User & {
  created_at?: string
  class_name?: string
  parent_names?: string[]
}

export function mapUserResponse(res: { access_token?: string; accessToken?: string; user?: RawUser }): {
  accessToken: string
  user: User
} {
  const token = res.access_token ?? res.accessToken ?? ''
  const parsed = rawUserSchema.safeParse(res.user)
  if (!parsed.success) {
    throw new Error('Invalid user payload in auth response')
  }
  const raw = parsed.data
  const user: User = {
    id: raw.id,
    name: raw.name,
    role: raw.role,
    email: raw.email,
    ...(raw.class_name !== undefined && { className: raw.class_name }),
    ...(raw.parent_names !== undefined && { parentNames: raw.parent_names }),
  }
  if (typeof raw.created_at === 'string') {
    (user as User & { createdAt?: string }).createdAt = raw.created_at
  }
  return { accessToken: token, user }
}
