import { useContext } from 'react'

import { ChildSelectionContext } from './childSelectionContext'

export function useChildSelectionContext() {
  const ctx = useContext(ChildSelectionContext)
  if (!ctx) {
    throw new Error('useChildSelection must be used within ChildSelectionProvider')
  }
  return ctx
}
