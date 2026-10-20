export const hasValidSeatPrice = (price) => Number.isSafeInteger(price) && price >= 0

export const formatSeatMoney = (price) => hasValidSeatPrice(price)
  ? `${new Intl.NumberFormat('vi-VN').format(price)} ₫`
  : 'Price unavailable'

export const sumSeatPrices = (seats) => {
  if (seats.some(({ price }) => !hasValidSeatPrice(price))) return null
  const total = seats.reduce((sum, { price }) => sum + price, 0)
  return Number.isSafeInteger(total) ? total : null
}
