import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

const sampleCampaigns = [
  {
    title: 'Weekday Movie Break',
    description: 'A ticket discount campaign for a movie night during the week.',
  },
  {
    title: 'Premiere Week',
    description: 'A launch-week ticket discount campaign celebrating a new release.',
  },
  {
    title: 'Holiday at the Movies',
    description: 'A seasonal ticket discount campaign for a cinema trip over the holidays.',
  },
]

function TicketArtwork() {
  return (
    <svg
      aria-hidden="true"
      className="h-auto w-full max-w-xl justify-self-center"
      viewBox="0 0 480 292"
      fill="none"
    >
      <g transform="rotate(-11 240 146)">
        <path
          className="fill-surface-container-highest"
          d="M47 75H409V128A19 19 0 0 0 409 166V218H47V166A19 19 0 0 0 47 128Z"
        />
      </g>
      <g transform="rotate(9 240 146)">
        <path
          className="fill-primary-container"
          d="M69 74H431V127A19 19 0 0 0 431 165V218H69V165A19 19 0 0 0 69 127Z"
        />
        <path className="stroke-on-primary-container/65" d="M347 87V205" strokeWidth="3" strokeDasharray="5 8" />
        <path
          className="fill-on-primary-container"
          d="M204 98C208 127 220 140 250 146C220 152 208 165 204 194C199 165 186 152 157 146C186 140 199 127 204 98Z"
        />
        <path className="stroke-on-primary-container" d="M368 132H399M368 146H390M368 160H399" strokeWidth="4" />
      </g>
    </svg>
  )
}

export default function OffersPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-28 sm:px-8 sm:pb-24 lg:pt-32">
      <section aria-labelledby="offers-title" className="grid items-center gap-8 bg-surface-container-low px-6 py-10 sm:px-10 md:grid-cols-2 lg:px-14 lg:py-14">
        <div>
          <h1 id="offers-title" className="max-w-[12ch] font-heading text-[clamp(2.65rem,5.8vw,5.5rem)] leading-none font-extrabold tracking-tight text-balance">
            Online ticket offers
          </h1>
          <p className="mt-6 max-w-[38ch] text-base leading-relaxed text-on-surface sm:text-lg">
            Explore sample F-Cinema campaigns and see how ticket discounts work when you book online.
          </p>
          <Link
            to="/movies"
            className="mt-7 inline-flex items-center gap-2.5 bg-primary-container px-5 py-3 font-semibold text-on-primary-container transition-colors hover:bg-[#c0000c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Browse movies <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
        <TicketArtwork />
      </section>

      <section aria-labelledby="campaigns-title" className="mt-14 grid gap-6 md:grid-cols-[2fr_3fr] md:gap-10 lg:mt-20">
        <div>
          <h2 id="campaigns-title" className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Sample campaigns
          </h2>
          <p className="mt-4 max-w-[32ch] leading-relaxed text-on-surface">
            These examples show what a campaign could look like. They are unavailable for redemption.
          </p>
        </div>
        <ul className="space-y-2">
          {sampleCampaigns.map(({ title, description }) => (
            <li key={title} className="grid gap-2 bg-surface-container-low px-5 py-5 sm:grid-cols-[2fr_3fr] sm:gap-6 sm:px-6">
              <h3 className="font-heading text-lg font-bold">{title}</h3>
              <p className="leading-relaxed text-on-surface">{description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="redeem-title" className="mt-14 grid gap-5 bg-surface-container-high px-6 py-8 sm:px-10 md:grid-cols-[2fr_3fr] md:items-center lg:mt-20 lg:px-14">
        <h2 id="redeem-title" className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Using an offer
        </h2>
        <p className="max-w-[57ch] leading-relaxed text-on-surface">
          Already have a voucher? Choose a movie and showtime, then enter your voucher at checkout. Review the updated total before paying.
        </p>
      </section>
    </div>
  )
}
