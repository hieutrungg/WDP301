function AuthPageShell({ eyebrow, title, description, benefits = [], children }) {
  return (
    <section className="relative min-h-[760px] overflow-hidden px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-24 lg:pt-32">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBsziRUp-wgoe_PqsTlKBrciFryZZiaeJdhMFcrcYCBPJikUbBEgX32v2dOLevPSyn3mJjCYw3Ll0uWy7I4KOk0Z7w7DjZpkZ958jLnmSBfMDY6Sl_p1_92sTnykFlow4_a2yWCOIg_CeYoDkxOYyJ3Kbmi_V2u58UuyooO5TIEnREvfaEISpszpel9orJHlbWM_N7fijgavWhMfFmt-fYzqic_jzvYF-F5HQgQPZhXhpyJsZNRkqslAw')",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,14,18,.97)_0%,rgba(13,14,18,.82)_45%,rgba(13,14,18,.9)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,rgba(229,9,20,.18),transparent_35%)]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
        <div className="hidden lg:block">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-secondary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-secondary">
            {eyebrow}
          </div>
          <h2 className="max-w-xl font-heading text-5xl font-extrabold leading-[1.08] text-white">
            {title}
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-on-surface-variant">
            {description}
          </p>
          <div className="mt-8 grid gap-4">
            {benefits.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-on-surface">
                <span className="grid size-9 place-items-center rounded-lg bg-primary-container/15 text-primary">
                  <Icon className="size-4" />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        {children}
      </div>
    </section>
  )
}

export default AuthPageShell
