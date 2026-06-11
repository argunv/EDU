import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getMyChildren } from '../../api/me'
import { useAuth } from '../auth/useAuth'

import {
  ChildSelectionContext,
  type ChildOption,
  STORAGE_KEY,
} from './childSelectionContext'

export function ChildSelectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    data: childrenList = [],
    isLoading: isChildrenLoading,
    isError: isChildrenError,
  } = useQuery({
    queryKey: ['me', 'children'],
    queryFn: getMyChildren,
    enabled: user?.role === 'parent',
  })

  const [childId, setChildIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(STORAGE_KEY) ?? ''
  })

  const setChildId = useCallback((id: string) => {
    setChildIdState(id)
  }, [])

  const resolvedChildId = useMemo(() => {
    if (!childrenList.length) return ''
    if (!childId || !childrenList.some((c) => c.id === childId)) {
      return childrenList[0]?.id ?? ''
    }
    return childId
  }, [childrenList, childId])

  useEffect(() => {
    if (resolvedChildId) localStorage.setItem(STORAGE_KEY, resolvedChildId)
  }, [resolvedChildId])

  const value = useMemo(
    () => ({
      childId: resolvedChildId,
      setChildId,
      children: childrenList as ChildOption[],
      isChildrenLoading,
      isChildrenError,
    }),
    [resolvedChildId, setChildId, childrenList, isChildrenLoading, isChildrenError],
  )

  return (
    <ChildSelectionContext.Provider value={value}>{children}</ChildSelectionContext.Provider>
  )
}
