import { ChevronRight, House } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'

// `items` after Home: [{ label, to? }]; the last one is the current page.
function AccountBreadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-tertiary">
      <Link to="/" className="flex items-center gap-1 transition-colors hover:text-on-surface">
        <House className="size-4" />
        Home
      </Link>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1

        return (
          <Fragment key={item.label}>
            <ChevronRight className="size-3.5 text-tertiary-container" />
            {isCurrent ? (
              <span aria-current="page" className="font-semibold text-on-surface">
                {item.label}
              </span>
            ) : item.to ? (
              <Link to={item.to} className="transition-colors hover:text-on-surface">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}

export default AccountBreadcrumb
