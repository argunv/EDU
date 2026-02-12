import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import { getMyChildren } from '../../api/me'
import { useAuth } from '../auth/useAuth'

const STORAGE_KEY = 'abh-edu-child'

type ChildOption = { id: string; name: string; className: string }

type ChildSelectionContextValue = {
  childId: string
  setChildId: (id: string) => void
  children: ChildOption[]
  isChildrenLoading: boolean
  isChildrenError: boolean
}

const ChildSelectionContext = createContext<ChildSelectionContextValue | null>(null)

export function ChildSelectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    data: childrenList = [],
    isLoading: isChildrenLoading,
    isError: isChildrenError,
  } = useQuery({
    queryKey: ['me', 'children'],
    queryFn: getMyChildren,
    enabled: !!user,
  })
  // Единственный источник истины для child_id — ответ GET /me/children (id = users.id, role=student).

  const [childId, setChildIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(STORAGE_KEY) ?? ''
  })

  const setChildId = useCallback((id: string) => {
    setChildIdState(id)
  }, [])

  useEffect(() => {
    if (childrenList.length && (!childId || !childrenList.some((c) => c.id === childId))) {
      setChildIdState(childrenList[0]?.id ?? '')
    }
  }, [childrenList, childId])

  useEffect(() => {
    if (childId) localStorage.setItem(STORAGE_KEY, childId)
  }, [childId])

  const value = useMemo(
    () => ({
      childId,
      setChildId,
      children: childrenList,
      isChildrenLoading,
      isChildrenError,
    }),
    [childId, setChildId, childrenList, isChildrenLoading, isChildrenError]
  )

  return (
    <ChildSelectionContext.Provider value={value}>
      {children}
    </ChildSelectionContext.Provider>
  )
}

export function useChildSelectionContext(): ChildSelectionContextValue {
  const ctx = useContext(ChildSelectionContext)
  if (!ctx) {
    throw new Error('useChildSelection must be used within ChildSelectionProvider')
  }
  return ctx
}
