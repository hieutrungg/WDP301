import { useState } from 'react'
import { getCurrentAccountRequest, loginRequest } from '../api/authApi'
import { useAuthStore } from '../store/authStore'

export function useLogin() {
  const [isPending, setIsPending] = useState(false)
  const setAccount = useAuthStore((state) => state.setAccount)

  const login = async (credentials) => {
    setIsPending(true)

    try {
      await loginRequest(credentials)
      const account = await getCurrentAccountRequest()
      setAccount(account)
      return account
    } finally {
      setIsPending(false)
    }
  }

  return { login, isPending }
}
