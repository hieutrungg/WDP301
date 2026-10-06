import { ArrowRight, Armchair, AudioLines, Video } from 'lucide-react'

const experiences = [
  { title: 'IMAX with Laser 4K', badge: '24M Curved Screen', description: 'Ultra-high resolution paired with next-gen laser engines brings vivid true-to-life colors and incredible contrast to the giant curved screen.', action: 'Explore IMAX', icon: Video, accent: 'text-primary-container', glow: 'bg-primary-container/10' },
  { title: 'Dolby Atmos Surround', badge: '7.1.4 Immersive Audio', description: '360-degree ceiling surround sound creates lifelike, nuanced acoustics flowing throughout the auditorium, from gentle whispers to visceral rumbles.', action: 'Experience Soundstage', icon: AudioLines, accent: 'text-secondary', glow: 'bg-secondary/10' },
  { title: 'Sweetbox VIP Double Seats', badge: 'Exclusive Privacy', description: 'High partitions with plush cushioning, ergonomic reclining backs, and dedicated access aisles offer the ultimate private cinematic experience for couples.', action: 'Explore Sweetbox', icon: Armchair, accent: 'text-primary', glow: 'bg-primary/10' },
]

function CinemaExperienceSection() {
  return (
    <section id="theatres-&-tickets" className="my-6 bg-surface-container-lowest py-10 sm:py-12">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-secondary">Leading Technology</p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-on-surface sm:text-3xl">World-Class Cinema Experience at F-Cinema</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">International standard projection halls delivering an explosive sensory experience, immersing audiences in every artistic frame.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {experiences.map(({ title, badge, description, action, icon: Icon, accent, glow }) => (
            <article key={title} className="group relative flex min-h-80 flex-col justify-between overflow-hidden rounded-xl border border-white/5 bg-surface-container p-6 shadow-xl transition-colors hover:bg-surface-container-high">
              <span className={`pointer-events-none absolute -bottom-6 -right-6 size-32 rounded-full blur-2xl ${glow}`} />
              <div className="relative space-y-4">
                <span className={`grid size-14 place-items-center rounded-xl bg-surface-container-highest ${accent}`}><Icon className="size-8" /></span>
                <div><span className={`inline-block rounded bg-surface-container-highest px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${accent}`}>{badge}</span><h3 className="mt-2 font-heading text-xl font-bold text-on-surface sm:text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p></div>
              </div>
              <a href="#" className={`relative mt-6 inline-flex items-center gap-1 text-sm font-semibold ${accent}`}>{action}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CinemaExperienceSection
