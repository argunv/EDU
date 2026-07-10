import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { apiLogin, apiLogout, apiMe, type LoginCredentials } from '../../api/auth'
import { configureAuth } from '../../api/client'
import { type User } from '../../types/user'

import { AuthContext, type AuthContextValue } from './authContextCore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    tokenRef.current = accessToken
  }, [accessToken])

  useEffect(() => {
    configureAuth({
      getToken: () => tokenRef.current,
      setToken: setAccessToken,
      setUser,
      logout: () => {
        setAccessToken(null)
        setUser(null)
      },
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    apiMe()
      .then((res) => {
        if (cancelled) return
        if (res) {
          setAccessToken(res.accessToken)
          setUser(res.user)
          queryClient.invalidateQueries({ queryKey: ['me'] })
        }
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [queryClient])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const res = await apiLogin(credentials)
      setAccessToken(res.accessToken)
      setUser(res.user)
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    [queryClient],
  )

  const setUserFromToken = useCallback((token: string, u: User) => {
    setAccessToken(token)
    setUser(u)
  }, [])

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // ignore
    }
    setAccessToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, login, logout, setUserFromToken, updateUser, ready }),
    [user, accessToken, login, logout, setUserFromToken, updateUser, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
