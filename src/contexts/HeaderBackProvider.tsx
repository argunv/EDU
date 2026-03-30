import { useCallback } from 'react'

import { HeaderBackContext, type BackTarget } from './headerBack'

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
    [setBackTarget],
  )
  const clearBack = useCallback(() => setBackTarget(null), [setBackTarget])
  return (
    <HeaderBackContext.Provider value={{ setBack, clearBack }}>
      {children}
    </HeaderBackContext.Provider>
  )
}
