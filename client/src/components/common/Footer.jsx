import { BadgeCheck, Phone } from 'lucide-react'
import AppLogo from './AppLogo'

const exploreLinks = ['Home', 'Now Showing', 'Nationwide Showtimes', 'Theatres & Ticket Pricing', 'F-Club Member Privileges']
const policyLinks = ['About F-Cinema', 'Terms of Service', 'Privacy Policy', 'Online Booking Guide', 'FAQ']
const paymentPartners = ['MoMo', 'VNPAY', 'ZaloPay', 'VISA / MC']

function FooterLinks({ title, links }) {
  return (
    <div>
      <h3 className="mb-4 font-heading text-lg font-semibold text-on-surface">{title}</h3>
      <ul className="space-y-2 text-sm text-on-surface-variant">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="transition-colors hover:text-on-surface">{link}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Footer() {
  return (
    <footer className="bg-surface-container-lowest px-4 pb-6 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-10 pb-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <AppLogo />
            <p className="max-w-sm text-sm leading-6 text-on-surface-variant">Leading modern cinema network in Vietnam. Experience top-tier cinema with IMAX Laser, ScreenX, and Dolby Atmos surround sound.</p>
            <div className="flex items-center gap-2">
              <Phone className="size-5 text-primary-container" />
              <div>
                <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">24/7 CUSTOMER SUPPORT</p>
                <p className="font-heading text-lg font-semibold text-secondary">1900 6868</p>
              </div>
            </div>
          </div>
          <FooterLinks title="Explore & Book" links={exploreLinks} />
          <FooterLinks title="Policies & Support" links={policyLinks} />
          <div>
            <h3 className="mb-4 font-heading text-lg font-semibold text-on-surface">Payment Partners</h3>
            <p className="mb-3 text-sm text-on-surface-variant">Secure payments guaranteed via certified partners:</p>
            <div className="grid grid-cols-2 gap-2">
              {paymentPartners.map((partner) => (
                <span key={partner} className="rounded-lg bg-surface-container-high px-3 py-2 text-center text-xs font-semibold text-on-surface">{partner}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
              <BadgeCheck className="size-4 text-secondary" />
              <span>256-bit SSL Certified Encryption</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/5 pt-5 text-xs text-on-surface-variant md:flex-row md:items-center md:justify-between">
          <p>© 2025 F-Cinema Vietnam. All rights reserved.</p>
          <p>License No: 0312345678 - Department of Planning and Investment of HCMC</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
