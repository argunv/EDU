import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
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
        const accessToken = data.access_token ?? data.accessToken
        const user = data.user
        if (setToken && accessToken) setToken(accessToken)
        if (setUser && user) setUser(user)
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
  const raw = res.user
  if (!raw) return { accessToken: token, user: raw as unknown as User }
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
