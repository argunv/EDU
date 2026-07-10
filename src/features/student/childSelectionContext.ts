import { createContext } from 'react'

export const STORAGE_KEY = 'abh-edu-child'

export type ChildOption = { id: string; name: string; className: string; avatarUrl?: string }

export type ChildSelectionContextValue = {
  childId: string
  setChildId: (id: string) => void
  children: ChildOption[]
  isChildrenLoading: boolean
  isChildrenError: boolean
}

export const ChildSelectionContext = createContext<ChildSelectionContextValue | null>(null)
