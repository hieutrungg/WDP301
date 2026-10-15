import { useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../features/auth/hooks/useAuth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
})

function AppProvider({ children }) {
  const started = useRef(false)
  const { refreshSession } = useAuth()

  useEffect(() => {
    if (started.current) return
    started.current = true
    refreshSession()
  }, [refreshSession])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default AppProvider
