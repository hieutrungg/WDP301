import { useEffect, useRef, useState } from 'react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GSI_SRC = 'https://accounts.google.com/gsi/client?hl=en'
const MAX_BUTTON_WIDTH = 400

const buttonClass =
  'flex h-10 w-full items-center justify-center gap-3 rounded-lg bg-surface-container text-sm font-semibold text-on-surface transition-colors'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

let gsiPromise

const loadGoogleIdentity = () => {
  gsiPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = resolve
    script.onerror = () => {
      gsiPromise = undefined
      reject(new Error('Unable to load Google sign-in'))
    }
    document.head.appendChild(script)
  })

  return gsiPromise
}

// Renders Google's own button and hands the resulting ID token to `onCredential`.
function GoogleCredentialButton({ onCredential, disabled = false, text = 'continue_with' }) {
  const containerRef = useRef(null)
  const [loadFailed, setLoadFailed] = useState(false)

  // GIS keeps the callback it was initialized with, so always call the latest one.
  const onCredentialRef = useRef(onCredential)
  useEffect(() => {
    onCredentialRef.current = onCredential
  })

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined

    let cancelled = false

    loadGoogleIdentity()
      .then(() => {
        if (cancelled || !containerRef.current) return

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => onCredentialRef.current(credential),
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'rectangular',
          text,
          locale: 'en',
          logo_alignment: 'center',
          width: Math.min(containerRef.current.offsetWidth, MAX_BUTTON_WIDTH),
        })
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [text])

  if (!GOOGLE_CLIENT_ID || loadFailed) {
    return (
      <button type="button" disabled className={`${buttonClass} mx-auto max-w-[400px] opacity-60`}>
        <GoogleLogo />
        {loadFailed ? 'Google sign-in is unavailable' : 'Google sign-in is not configured'}
      </button>
    )
  }

  // Google's own button lives in a cross-origin iframe and can't be restyled, so a styled
  // button is drawn underneath and the real (nearly transparent) one sits on top to take clicks.
  return (
    <div className={`group relative mx-auto h-10 w-full max-w-[400px] ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <div className={`${buttonClass} pointer-events-none group-hover:bg-surface-container-high`}>
        <GoogleLogo />
        Continue with Google
      </div>
      <div ref={containerRef} className="absolute inset-0 overflow-hidden rounded-lg opacity-[0.01]" />
    </div>
  )
}

export default GoogleCredentialButton
