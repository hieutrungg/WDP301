import { useEffect, useRef } from 'react'
import { useAuth } from '../features/auth/hooks/useAuth'

function AppProvider({ children }) {
  const started = useRef(false)
  const { refreshSession } = useAuth()

  useEffect(() => {
    if (started.current) return
    started.current = true
    refreshSession()
  }, [refreshSession])

  return children
}

export default AppProvider
