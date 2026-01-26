import { createContext, useCallback, useContext } from 'react'

export type BackTarget =
  | { type: 'href'; href: string }
  | { type: 'callback'; onBack: () => void }

type HeaderBackContextValue = {
  setBack: (hrefOrCallback: string | (() => void)) => void
  clearBack: () => void
}

const HeaderBackContext = createContext<HeaderBackContextValue | null>(null)

export function HeaderBackProvider({
  children,
  setBackTarget,
}: {
  children: React.ReactNode
  setBackTarget: (v: BackTarget | null) => void
}) {
  const setBack = useCallback(
    (hrefOrCallback: string | (() => void)) => {
      if (typeof hrefOrCallback === 'string') {
        setBackTarget({ type: 'href', href: hrefOrCallback })
      } else {
        setBackTarget({ type: 'callback', onBack: hrefOrCallback })
      }
    },
    [setBackTarget]
  )
  const clearBack = useCallback(() => setBackTarget(null), [setBackTarget])
  return (
    <HeaderBackContext.Provider value={{ setBack, clearBack }}>
      {children}
    </HeaderBackContext.Provider>
  )
}

export function useHeaderBack() {
  return useContext(HeaderBackContext)
}
