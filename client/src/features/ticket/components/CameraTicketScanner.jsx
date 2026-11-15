import { useEffect, useRef, useState } from 'react'
import { validateTicketCode } from '../utils/checkIn'

export default function CameraTicketScanner({ onScan, disabled }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const generationRef = useRef(0)
  const [error, setError] = useState('')
  const [active, setActive] = useState(false)
  const stop = () => {
    generationRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
  }
  useEffect(() => () => {
    generationRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])
  const start = async () => {
    const generation = ++generationRef.current
    setError('')
    setActive(true)
    try {
      if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera QR scanning is unavailable in this browser. Use a QR reader or enter the ticket code.')
      }
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      const scan = async () => {
        if (generation !== generationRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (generation !== generationRef.current) return
          const ticket = codes.find(({ rawValue }) => !validateTicketCode(rawValue))
          if (ticket) {
            stop()
            await onScan(ticket.rawValue)
            return
          }
          setTimeout(scan, 200)
        } catch {
          if (generation !== generationRef.current) return
          stop()
          setError('Unable to read the camera. Try again or enter the ticket code.')
        }
      }
      void scan()
    } catch (failure) {
      if (generation !== generationRef.current) return
      stop()
      setError(failure.name === 'NotAllowedError' ? 'Camera access was denied. Allow camera access or use a QR reader.' : failure.message)
    }
  }
  return <section className="rounded-2xl border border-white/5 bg-surface-container-low p-4">
    <button type="button" disabled={disabled} onClick={active ? stop : start} className="rounded-lg bg-surface-container-high px-4 py-2 text-sm font-semibold disabled:opacity-50">{active ? 'Stop camera' : 'Scan ticket QR'}</button>
    <video ref={videoRef} muted playsInline aria-label="Ticket QR camera" className={active ? 'mt-3 max-h-72 w-full rounded-xl bg-black object-contain' : 'hidden'} />
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
  </section>
}
