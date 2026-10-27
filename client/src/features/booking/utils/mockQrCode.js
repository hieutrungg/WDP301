export const PAYMENT_METHODS = Object.freeze({
  BANK_TRANSFER: 'BANK_TRANSFER',
  MOMO_WALLET: 'MOMO_WALLET',
  VNPAY_QR: 'VNPAY_QR',
  CREDIT_DEBIT_CARD: 'CREDIT_DEBIT_CARD',
  ZALOPAY_APPLE_PAY: 'ZALOPAY_APPLE_PAY',
})

// The server reports `provider: 'PAYOS'` on attempts that go through real payOS bank transfer;
// every other attempt is the internal mock gateway.
export const isBankTransferAttempt = (attempt) => attempt?.provider === 'PAYOS'

export const PAYMENT_METHOD_OPTIONS = Object.freeze([
  {
    id: PAYMENT_METHODS.BANK_TRANSFER,
    label: 'Bank transfer (VietQR)',
    subtitle: 'payOS • Any Vietnamese banking app',
    gatewayTitle: 'payOS — VietQR Bank Transfer',
    badge: 'QR',
    badgeBg: 'bg-[#0A7C3E]',
    badgeText: 'text-white',
    instructions: [
      'Open your banking app and scan the VietQR code.',
      'Keep the exact amount and transfer content shown below.',
      'The page confirms automatically once payOS reports the transfer.',
    ],
  },
  {
    id: PAYMENT_METHODS.MOMO_WALLET,
    label: 'MoMo E-Wallet',
    subtitle: 'Official Partner • Instant Refund',
    gatewayTitle: 'MoMo E-Wallet Payment Gateway',
    badge: 'MoMo',
    badgeBg: 'bg-[#A50064]',
    badgeText: 'text-white',
    instructions: [
      'Open the MoMo app or use the Mock Action below.',
      'Verify the F-Cinema booking reference and VND total.',
      'Click "Simulate successful payment" to simulate verified settlement.',
    ],
  },
  {
    id: PAYMENT_METHODS.VNPAY_QR,
    label: 'VNPAY-QR / VietQR',
    subtitle: '30+ Vietnam Banking Apps',
    gatewayTitle: 'VNPay — QR / MomoQR Gateway',
    badge: 'VNPAY',
    badgeBg: 'bg-[#005BAA]',
    badgeText: 'text-white',
    instructions: [
      'Scan with any VietQR / VNPAY-QR banking app (Demo Mode).',
      'Confirm the exact integer VND amount locked by the server.',
      'Click "Simulate successful payment" to simulate verified settlement.',
    ],
  },
  {
    id: PAYMENT_METHODS.CREDIT_DEBIT_CARD,
    label: 'Credit / Debit Card',
    subtitle: 'Visa, Mastercard, JCB, Amex',
    gatewayTitle: 'International Card Payment Gateway',
    badge: 'CARD',
    badgeBg: 'bg-[#1A1F71]',
    badgeText: 'text-white',
    instructions: [
      '3D-Secure / EMV QR verification simulated via Internal Mock Gateway.',
      'No real card numbers or external API keys are transmitted.',
      'Click "Simulate successful payment" to simulate verified settlement.',
    ],
  },
  {
    id: PAYMENT_METHODS.ZALOPAY_APPLE_PAY,
    label: 'ZaloPay / Apple Pay',
    subtitle: '1-Touch Biometric checkout',
    gatewayTitle: 'ZaloPay / Apple Pay Express Bridge',
    badge: 'Zalo',
    badgeBg: 'bg-[#008FE5]',
    badgeText: 'text-white',
    instructions: [
      'Express biometric / QR token generated in Demo Mode.',
      'Verify booking reference and countdown timer before confirming.',
      'Click "Simulate successful payment" to simulate verified settlement.',
    ],
  },
])

export function getPaymentMethodOption(methodId) {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.id === methodId) ??
    PAYMENT_METHOD_OPTIONS[0]
  )
}

export function buildPaymentAttemptKey({
  bookingId,
  method,
  attemptSequence = 1,
}) {
  return `pay-attempt:${bookingId}:${method}:${attemptSequence}`
}

const isFinderModule = (row, col, top, left) => {
  const r = row - top
  const c = col - left
  if (r < 0 || r >= 7 || c < 0 || c >= 7) return null
  if (r === 0 || r === 6 || c === 0 || c === 6) return true
  if (r >= 2 && r <= 4 && c >= 2 && c <= 4) return true
  return false
}

export function generateDeterministicQrMatrix(payload, size = 25) {
  const text = String(payload || 'FCINEMA-MOCK-QR')
  const matrix = Array.from({ length: size }, () => Array(size).fill(false))

  let seed = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    seed ^= text.charCodeAt(i)
    seed = Math.imul(seed, 16777619) >>> 0
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const topLeft = isFinderModule(row, col, 0, 0)
      const topRight = isFinderModule(row, col, 0, size - 7)
      const bottomLeft = isFinderModule(row, col, size - 7, 0)

      if (topLeft !== null) {
        matrix[row][col] = topLeft
        continue
      }
      if (topRight !== null) {
        matrix[row][col] = topRight
        continue
      }
      if (bottomLeft !== null) {
        matrix[row][col] = bottomLeft
        continue
      }

      // Quiet separator border around finder patterns
      if (
        (row === 7 && (col <= 7 || col >= size - 8)) ||
        (col === 7 && (row <= 7 || row >= size - 8)) ||
        (row === size - 8 && col <= 7) ||
        (col === size - 8 && row <= 7)
      ) {
        matrix[row][col] = false
        continue
      }

      // Timing lines
      if (row === 6 || col === 6) {
        matrix[row][col] = (row + col) % 2 === 0
        continue
      }

      const charCode = text.charCodeAt((row * size + col) % text.length)
      const mixed =
        ((seed >>> ((row + col) % 16)) ^
          (charCode * 31) ^
          (row * 17 + col * 29)) &
        0xff
      matrix[row][col] = mixed % 2 === 0
    }
  }

  return matrix
}
