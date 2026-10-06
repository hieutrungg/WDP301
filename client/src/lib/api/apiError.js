export function getApiErrorMessage(error) {
  if (!error.response) {
    return 'Unable to reach the server. Please check your connection and try again.'
  }

  return error.response.data?.message || 'Something went wrong. Please try again.'
}
