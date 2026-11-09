import { create } from 'zustand'

// Chat panel state. The conversation lives on the server; only its id and the visible messages
// are kept here. The owner key resets the chat when the signed-in account changes.
export const useAiChatStore = create((set) => ({
  open: false,
  ownerKey: null,
  conversationId: null,
  messages: [],
  setOpen: (open) => set({ open }),
  resetFor: (ownerKey) => set({ ownerKey, conversationId: null, messages: [] }),
  setConversationId: (conversationId) => set({ conversationId }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateAction: (actionId, patch) => set((state) => ({
    messages: state.messages.map((message) => message.actions?.some(({ id }) => id === actionId)
      ? { ...message, actions: message.actions.map((action) => action.id === actionId ? { ...action, ...patch } : action) }
      : message),
  })),
}))
