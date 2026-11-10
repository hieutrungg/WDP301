import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { getApiErrorMessage } from '../../../lib/api/apiError'
import { useAuth } from '../../auth/hooks/useAuth'
import { cancelAiAction, confirmAiAction, sendAiMessage } from '../api/aiApi'
import { useAiChatStore } from '../store/aiChatStore'
import { matchActionReply, singlePendingAction } from '../utils/aiMessage'

let localId = 0
const nextId = () => {
  localId += 1
  return `local-${localId}`
}

export function useAiChat() {
  const { account } = useAuth()
  const store = useAiChatStore()
  const ownerKey = account?.id ?? 'guest'
  const { resetFor } = store

  // A new sign-in (or sign-out) starts a new conversation: never show one account's chat to another.
  useEffect(() => {
    if (useAiChatStore.getState().ownerKey !== ownerKey) resetFor(ownerKey)
  }, [ownerKey, resetFor])

  const send = useMutation({
    mutationFn: sendAiMessage,
    onSuccess: (data) => {
      store.setConversationId(data.conversationId)
      store.addMessage({
        id: data.traceId ?? nextId(),
        role: 'assistant',
        content: data.reply,
        citations: data.citations ?? [],
        actions: (data.pendingActions ?? []).map((action) => ({ ...action, state: 'pending' })),
        traceId: data.traceId,
      })
    },
    onError: (error) => {
      // A conversation that expired on the server starts over on the next message.
      if (error.response?.data?.code === 'AI_CONVERSATION_NOT_FOUND') store.setConversationId(null)
      store.addMessage({ id: nextId(), role: 'assistant', content: getApiErrorMessage(error), error: true })
    },
  })

  const settle = (actionId, run) => run(actionId)
    .then((result) => {
      store.updateAction(actionId, { state: result.status === 'EXECUTED' ? 'done' : result.status === 'CANCELLED' ? 'cancelled' : 'failed', message: result.message })
    })
    .catch((error) => {
      store.updateAction(actionId, { state: 'failed', message: getApiErrorMessage(error) })
    })

  const confirm = useMutation({ mutationFn: (actionId) => settle(actionId, confirmAiAction) })
  const cancel = useMutation({ mutationFn: (actionId) => settle(actionId, cancelAiAction) })

  const confirmAction = (actionId) => {
    store.updateAction(actionId, { state: 'working' })
    confirm.mutate(actionId)
  }
  const cancelAction = (actionId) => {
    store.updateAction(actionId, { state: 'working' })
    cancel.mutate(actionId)
  }

  const ask = (text) => {
    const message = text.trim()
    if (!message || send.isPending) return
    store.addMessage({ id: nextId(), role: 'user', content: message })
    // Typing "xác nhận" / "huỷ" while exactly one card is waiting presses that card's button.
    const reply = matchActionReply(message)
    const waiting = reply ? singlePendingAction(useAiChatStore.getState().messages) : null
    if (waiting) {
      if (reply === 'confirm') confirmAction(waiting.id)
      else cancelAction(waiting.id)
      return
    }
    send.mutate({ conversationId: useAiChatStore.getState().conversationId, message })
  }

  return {
    open: store.open,
    setOpen: store.setOpen,
    messages: store.messages,
    isSending: send.isPending,
    ask,
    confirmAction,
    cancelAction,
    newConversation: () => resetFor(ownerKey),
    signedIn: Boolean(account),
  }
}
