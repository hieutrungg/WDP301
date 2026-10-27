import { useMemo } from 'react'
import QRCode from 'qrcode'

// Standards-compliant, scannable QR (ISO/IEC 18004) rendered as inline SVG. Used for VietQR
// bank-transfer payloads and E-Ticket admission codes.
function QrCode({ value, size = 200, label, ariaLabel = 'QR code', className = '' }) {
  const matrix = useMemo(() => {
    if (!value) return null
    try {
      return QRCode.create(String(value), { errorCorrectionLevel: 'M' }).modules
    } catch {
      return null
    }
  }, [value])

  if (!matrix) {
    return (
      <div
        role="img"
        aria-label={`${ariaLabel} unavailable`}
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-2xl bg-white p-4 text-center text-xs font-semibold text-[#131315]"
      >
        QR unavailable
      </div>
    )
  }

  const quiet = 2
  const dimension = matrix.size + quiet * 2
  const cells = []
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (matrix.get(row, col)) {
        cells.push(<rect key={`${row}-${col}`} x={col + quiet} y={row + quiet} width="1" height="1" />)
      }
    }
  }

  return (
    <div className={`relative inline-flex items-center justify-center rounded-2xl bg-white p-3 shadow-xl ring-4 ring-primary/20 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="img"
        aria-label={ariaLabel}
        shapeRendering="crispEdges"
        className="block"
      >
        <rect width={dimension} height={dimension} fill="#FFFFFF" />
        <g fill="#131315">{cells}</g>
      </svg>
      {label && (
        <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-md border-2 border-white bg-[#131315] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-secondary shadow-md">
          {label}
        </span>
      )}
    </div>
  )
}

export default QrCode
