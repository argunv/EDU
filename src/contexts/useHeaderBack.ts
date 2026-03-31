import { useContext } from 'react'

import { HeaderBackContext } from './headerBack'

export function useHeaderBack() {
  return useContext(HeaderBackContext)
}
