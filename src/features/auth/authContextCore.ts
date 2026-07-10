import { createContext } from 'react'

import { type User } from '../../types/user'
import { type LoginCredentials } from '../../api/auth'

export type AuthContextValue = {
  user: User | null
  accessToken: string | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  setUserFromToken: (accessToken: string, user: User) => void
  updateUser: (patch: Partial<User>) => void
  ready: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
