import { useCallback } from 'react'
import {
  getCurrentAccountRequest,
  logoutRequest,
} from '../api/authApi'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const account = useAuthStore((state) => state.account)
  const initialized = useAuthStore((state) => state.initialized)
  const setAccount = useAuthStore((state) => state.setAccount)
  const clearAccount = useAuthStore((state) => state.clearAccount)
  const setInitialized = useAuthStore((state) => state.setInitialized)

  const refreshSession = useCallback(async () => {
    try {
      const currentAccount = await getCurrentAccountRequest()
      setAccount(currentAccount)
      return currentAccount
    } catch {
      clearAccount()
      return null
    }
  }, [clearAccount, setAccount])

  const logout = useCallback(async () => {
    await logoutRequest()
    clearAccount()
  }, [clearAccount])

  return {
    account,
    initialized,
    isAuthenticated: Boolean(account),
    refreshSession,
    logout,
    setInitialized,
  }
}
