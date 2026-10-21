import { Link, Outlet } from 'react-router'
import { useAuth } from '../../auth/hooks/useAuth'

export default function MovieManagementAccess() {
  const { account } = useAuth()
  if (account?.permissions?.some(({ name }) => name === 'movie.update')) return <Outlet />

  return <section className="mx-auto max-w-4xl space-y-4 px-6 py-10">
    <p className="text-sm font-bold text-primary">403 · Access denied</p>
    <h1 className="font-display text-3xl font-bold">Movie editing is unavailable</h1>
    <p role="alert" className="text-on-surface-variant">You do not have permission to update movies.</p>
    <Link className="inline-block rounded-lg border border-white/15 px-5 py-3 text-sm font-bold" to="/manager">Back to Manager</Link>
  </section>
}
