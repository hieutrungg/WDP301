import { ChevronUp, Copy, Eye, Mail, MapPin, Pencil, Phone, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { formatHotline } from '../utils/branchFormat'
import BranchDependencyPanel from './BranchDependencyPanel'
import BranchStatusBadge from './BranchStatusBadge'

const columns = 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_9rem_15rem]'

const copyHotline = async (hotline) => {
  try {
    await navigator.clipboard.writeText(hotline)
    toast.success(`Hotline ${formatHotline(hotline)} copied`)
  } catch {
    toast.error('Unable to copy to the clipboard')
  }
}

function ActionButton({ icon: Icon, label, onClick, tone = 'default', pressed }) {
  const tones = {
    default: 'text-on-surface hover:bg-surface-container-highest',
    danger: 'text-primary hover:bg-primary-container/15',
    success: 'text-secondary hover:bg-secondary/10',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-surface-container px-2.5 py-2 text-xs font-semibold transition-colors ${tones[tone]}`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function BranchRow({ branch, expanded, refreshToken, onToggleView, onEdit, onChangeStatus }) {
  const inactive = branch.status === 'INACTIVE'

  return (
    <li className={`border-t border-white/5 first:border-t-0 ${expanded ? 'bg-surface-container-lowest/60' : ''}`}>
      <div className={`grid gap-3 px-4 py-4 lg:items-start lg:gap-4 lg:px-5 ${columns}`}>
        <div className="min-w-0">
          <p className={`font-heading text-base font-bold ${inactive ? 'text-on-surface/60' : 'text-on-surface'}`}>
            {branch.branchName}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {branch.roomCount} {branch.roomCount === 1 ? 'room' : 'rooms'}
          </p>
        </div>

        <p className="flex min-w-0 items-start gap-2 text-sm text-on-surface/85">
          <MapPin className="mt-0.5 size-4 shrink-0 text-on-surface-variant" />
          <span className="break-words">{branch.address}</span>
        </p>

        <div className="min-w-0 space-y-1.5 text-sm">
          {branch.hotline ? (
            <p className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-on-surface-variant" />
              <span className="font-mono text-on-surface">{formatHotline(branch.hotline)}</span>
              <button
                type="button"
                onClick={() => copyHotline(branch.hotline)}
                aria-label={`Copy hotline of ${branch.branchName}`}
                className="grid size-6 place-items-center rounded text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              >
                <Copy className="size-3.5" />
              </button>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-on-surface-variant/70">
              <Phone className="size-4 shrink-0" />
              No hotline
            </p>
          )}
          <p className={`flex min-w-0 items-center gap-2 ${branch.email ? 'text-on-surface-variant' : 'text-on-surface-variant/70'}`}>
            <Mail className="size-4 shrink-0" />
            <span className="truncate">{branch.email ?? 'No email'}</span>
          </p>
        </div>

        <BranchStatusBadge status={branch.status} showHint />

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <ActionButton
            icon={expanded ? ChevronUp : Eye}
            label={expanded ? 'Hide' : 'View'}
            pressed={expanded}
            onClick={onToggleView}
          />
          <ActionButton icon={Pencil} label="Edit" onClick={onEdit} />
          {inactive ? (
            <ActionButton icon={Power} label="Enable" tone="success" onClick={onChangeStatus} />
          ) : (
            <ActionButton icon={PowerOff} label="Disable" tone="danger" onClick={onChangeStatus} />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 lg:px-5">
          <BranchDependencyPanel branchId={branch.id} refreshToken={refreshToken} />
        </div>
      )}
    </li>
  )
}

function BranchList({ branches, expandedId, refreshToken, onToggleView, onEdit, onChangeStatus }) {
  return (
    <div>
      <div
        className={`hidden gap-4 border-b border-white/5 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant lg:grid ${columns}`}
      >
        <span>Branch</span>
        <span>Address</span>
        <span>Contact</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <ul>
        {branches.map((branch) => (
          <BranchRow
            key={branch.id}
            branch={branch}
            expanded={expandedId === branch.id}
            refreshToken={refreshToken}
            onToggleView={() => onToggleView(branch.id)}
            onEdit={() => onEdit(branch)}
            onChangeStatus={() => onChangeStatus(branch)}
          />
        ))}
      </ul>
    </div>
  )
}

export default BranchList
