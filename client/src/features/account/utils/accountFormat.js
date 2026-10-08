export const getDisplayName = (account) =>
  account?.profile?.fullName || account?.username || account?.email || ''

export const getAvatarLabel = (account) =>
  getDisplayName(account).charAt(0).toUpperCase()

export const formatAccountStatus = (status) => {
  if (!status) return 'Unknown'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export const formatDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
