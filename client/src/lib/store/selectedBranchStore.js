import { create } from 'zustand'

const STORAGE_KEY = 'f-cinema:selected-branch-id'
const initialBranchId = typeof localStorage === 'undefined' ? '' : localStorage.getItem(STORAGE_KEY) || ''

export const useSelectedBranchStore = create((set) => ({
  selectedBranchId: initialBranchId,
  setSelectedBranchId: (branchId) => {
    if (typeof localStorage !== 'undefined') {
      if (branchId) localStorage.setItem(STORAGE_KEY, branchId)
      else localStorage.removeItem(STORAGE_KEY)
    }
    set({ selectedBranchId: branchId })
  },
}))
