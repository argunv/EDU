import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { apiLogin, apiLogout, apiMe, type LoginCredentials } from '../../api/auth'
import { configureAuth, waitForAuthRefresh } from '../../api/client'
import { type User } from '../../types/user'

import { AuthContext, type AuthContextValue } from './authContextCore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const tokenRef = useRef<string | null>(null)
  const sessionVersionRef = useRef(0)

  const applySession = useCallback((token: string, nextUser: User) => {
    tokenRef.current = token
    setAccessToken(token)
    setUser(nextUser)
  }, [])

  const clearSession = useCallback(() => {
    sessionVersionRef.current += 1
    tokenRef.current = null
    setAccessToken(null)
    setUser(null)
    void queryClient.cancelQueries()
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    configureAuth({
      getToken: () => tokenRef.current,
      setToken: (token) => {
        tokenRef.current = token
        setAccessToken(token)
      },
      setUser,
      logout: clearSession,
      getSessionVersion: () => sessionVersionRef.current,
    })
  }, [clearSession])

  useEffect(() => {
    let cancelled = false
    const sessionVersion = sessionVersionRef.current
    apiMe()
      .then((res) => {
        if (cancelled || sessionVersionRef.current !== sessionVersion) return
        if (res) {
          applySession(res.accessToken, res.user)
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
  }, [applySession, queryClient])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const sessionVersion = sessionVersionRef.current + 1
      sessionVersionRef.current = sessionVersion
      tokenRef.current = null
      setAccessToken(null)
      setUser(null)
      void queryClient.cancelQueries()
      queryClient.clear()
      const res = await apiLogin(credentials)
      if (sessionVersionRef.current !== sessionVersion) return
      applySession(res.accessToken, res.user)
      setReady(true)
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    [applySession, queryClient],
  )

  const setUserFromToken = useCallback(
    (token: string, u: User) => {
      sessionVersionRef.current += 1
      void queryClient.cancelQueries()
      queryClient.clear()
      applySession(token, u)
    },
    [applySession, queryClient],
  )

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const logout = useCallback(async () => {
    clearSession()
    await waitForAuthRefresh()
    try {
      await apiLogout()
    } catch {
      // ignore
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, login, logout, setUserFromToken, updateUser, ready }),
    [user, accessToken, login, logout, setUserFromToken, updateUser, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
