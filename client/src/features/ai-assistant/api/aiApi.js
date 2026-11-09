import httpClient from '../../../lib/api/httpClient'

// AI-001 assistant API (/api/ai).

export async function sendAiMessage({ conversationId, message }) {
  const response = await httpClient.post('/ai/chat', {
    ...(conversationId ? { conversationId } : {}),
    message,
  })
  return response.data.data
}

export async function confirmAiAction(actionId) {
  const response = await httpClient.post(`/ai/actions/${actionId}/confirm`)
  return response.data.data
}

export async function cancelAiAction(actionId) {
  const response = await httpClient.post(`/ai/actions/${actionId}/cancel`)
  return response.data.data
}
