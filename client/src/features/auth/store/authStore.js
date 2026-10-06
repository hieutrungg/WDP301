import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  account: null,
  initialized: false,
  setAccount: (account) => set({ account, initialized: true }),
  clearAccount: () => set({ account: null, initialized: true }),
  setInitialized: () => set({ initialized: true }),
}))
