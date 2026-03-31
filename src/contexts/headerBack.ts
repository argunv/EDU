import { createContext } from 'react'

export type BackTarget =
  | { type: 'href'; href: string }
  | { type: 'callback'; onBack: () => void }

export type HeaderBackContextValue = {
  setBack: (hrefOrCallback: string | (() => void)) => void
  clearBack: () => void
}

export const HeaderBackContext = createContext<HeaderBackContextValue | null>(null)
