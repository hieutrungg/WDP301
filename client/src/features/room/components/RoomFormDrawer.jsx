import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, DoorOpen, Film, History, Info, Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage, getApiFieldErrors } from '../../../lib/api/apiError'
import { createRoomRequest, updateRoomRequest } from '../api/roomApi'
import {
  PRICED_ROOM_TYPES,
  ROOM_TYPE_SUGGESTIONS,
  emptyRoomForm,
  normalizeRoomType,
  roomFormSchema,
  toRoomForm,
} from '../schema/roomSchema'
import { formatDateTime, pluralize } from '../utils/roomFormat'
import RoomOverlay from './RoomOverlay'

const inputClass =
  'w-full rounded-lg border border-transparent bg-surface-container px-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/50 focus:border-primary-container/50 focus:bg-surface-container-high focus:ring-2 focus:ring-primary-container/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-400/50'

function Field({ id, label, hint, required = true, icon: Icon, error, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-on-surface">
          {label}
        </label>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${required ? 'bg-primary-container/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}
        >
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-on-surface-variant" />}
        {children}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-300">{error.message}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-on-surface-variant">{hint}</p>
      )}
    </div>
  )
}

function RoomFormDrawer({ room, branches, branchesLoading, branchesError, onClose, onSaved }) {
  const isEdit = Boolean(room)
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const initialValues = isEdit ? toRoomForm(room) : emptyRoomForm
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(roomFormSchema), defaultValues: initialValues })

  const roomType = normalizeRoomType(useWatch({ control, name: 'roomType' }) ?? '')
  const typeFrozen = isEdit && room.upcomingShowtimeCount > 0
  const unpriced = roomType !== '' && !PRICED_ROOM_TYPES.includes(roomType)

  const onSubmit = async (values) => {
    setServerError('')

    try {
      let saved
      if (isEdit) {
        const changes = {}
        if (values.roomName.trim() !== room.roomName) changes.roomName = values.roomName
        if (normalizeRoomType(values.roomType) !== (room.roomType ?? '')) changes.roomType = values.roomType

        if (Object.keys(changes).length === 0) {
          toast.info('No changes to save.')
          onClose()
          return
        }

        saved = await updateRoomRequest(room.id, changes)
        toast.success('Room updated', { description: `${saved.roomName} was saved.` })
      } else {
        saved = await createRoomRequest(values)
        toast.success('Room created', {
          description: `${saved.roomName} was added. Configure its seat map before scheduling showtimes.`,
          action: { label: 'Configure seat map', onClick: () => navigate(`/manager/seat-maps?roomId=${saved.id}`) },
        })
      }

      onSaved(saved)
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter((item) => item.field in initialValues)
      fieldErrors.forEach(({ field, message }) => setError(field, { message }))
      if (fieldErrors.length === 0) setServerError(getApiErrorMessage(error))
    }
  }

  const noBranches = !isEdit && !branchesLoading && !branchesError && branches.length === 0

  return (
    <RoomOverlay
      variant="drawer"
      icon={DoorOpen}
      title={isEdit ? 'Edit room' : 'Add new room'}
      description={
        isEdit
          ? 'Name and format changes apply immediately wherever the room is shown.'
          : 'A new room starts without seats. Configure its seat map next so it can be scheduled.'
      }
      onClose={onClose}
      busy={isSubmitting}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isEdit && (
            <p className="flex items-center gap-2 rounded-lg bg-surface-container-lowest/70 px-3 py-2 text-xs text-on-surface-variant">
              <History className="size-4 shrink-0" />
              Last modified {formatDateTime(room.updatedAt) ?? '—'}
            </p>
          )}

          {serverError && (
            <div role="alert" className="rounded-lg border border-red-400/15 bg-error-container/40 p-3 text-sm text-on-error-container">
              {serverError}
            </div>
          )}

          {isEdit ? (
            <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container p-4 text-xs text-on-surface-variant">
              <Lock className="mt-0.5 size-4 shrink-0 text-secondary" />
              <p>
                <span className="block text-sm font-semibold text-on-surface">{room.branch.branchName ?? 'Unknown branch'}</span>
                A room stays in the branch it was created for, because its showtimes and bookings belong to that branch.
              </p>
            </div>
          ) : (
            <Field id="room-branch" label="Branch" icon={Building2} error={errors.branchId} hint="Only active branches can receive rooms.">
              <select
                id="room-branch"
                autoFocus
                disabled={branchesLoading || Boolean(branchesError) || noBranches}
                aria-invalid={Boolean(errors.branchId)}
                className={`${inputClass} h-12 appearance-none pl-10`}
                {...register('branchId')}
              >
                <option value="">
                  {branchesLoading ? 'Loading branches…' : branchesError ? 'Branches could not be loaded' : noBranches ? 'No active branch available' : 'Select a branch'}
                </option>
                {branches.map(({ id, branchName }) => (
                  <option key={id} value={id}>
                    {branchName}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            id="room-name"
            label="Room name"
            icon={DoorOpen}
            error={errors.roomName}
            hint="Shown to customers and managers. Must be unique within the branch, ignoring letter case and extra spaces."
          >
            <input
              id="room-name"
              autoFocus={isEdit}
              maxLength={60}
              aria-invalid={Boolean(errors.roomName)}
              placeholder="Room 01"
              className={`${inputClass} h-12 pl-10`}
              {...register('roomName')}
            />
          </Field>

          <Field
            id="room-type"
            label="Format"
            icon={Film}
            error={errors.roomType}
            hint={typeFrozen ? undefined : 'Pick a suggestion or type another label, for example IMAX. It is stored in capitals.'}
          >
            <input
              id="room-type"
              list="room-type-suggestions"
              maxLength={30}
              disabled={typeFrozen}
              aria-invalid={Boolean(errors.roomType)}
              placeholder="STANDARD"
              className={`${inputClass} h-12 pl-10 uppercase`}
              {...register('roomType')}
            />
            <datalist id="room-type-suggestions">
              {ROOM_TYPE_SUGGESTIONS.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </Field>

          {typeFrozen && (
            <p className="flex items-start gap-2 rounded-lg bg-secondary/10 p-3 text-xs text-secondary">
              <Lock className="mt-0.5 size-4 shrink-0" />
              The format is locked while this room has {pluralize(room.upcomingShowtimeCount, 'upcoming published showtime')}.
            </p>
          )}

          {unpriced && !typeFrozen && (
            <p className="flex items-start gap-2 rounded-lg bg-surface-container-lowest/70 p-3 text-xs text-on-surface-variant">
              <Info className="mt-0.5 size-4 shrink-0 text-secondary" />
              Ticket pricing is currently approved for STANDARD and 2D rooms only, so showtimes cannot be published in a
              {' '}{roomType} room until a price policy exists for it.
            </p>
          )}

          {isEdit ? (
            <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container p-4 text-xs text-on-surface-variant">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
              <p>
                <span className="block font-semibold text-on-surface">Status and seats are managed separately</span>
                Use Status on the room list to change availability, and Seat map to change the layout. Capacity is
                calculated from the seat map.
              </p>
            </div>
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-on-surface">Initial status</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['ACTIVE', 'Active', 'Can be scheduled once it has a seat map'],
                  ['MAINTENANCE', 'Maintenance', 'Closed for scheduling until enabled'],
                ].map(([value, label, hint]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-surface-container p-3 has-[:checked]:border-primary-container/50 has-[:checked]:bg-primary-container/10"
                  >
                    <input type="radio" value={value} className="mt-1 accent-primary-container" {...register('status')} />
                    <span>
                      <span className="block text-sm font-semibold text-on-surface">{label}</span>
                      <span className="text-xs text-on-surface-variant">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (isEdit && !isDirty) || noBranches}
            className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-white shadow-crimson transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create room'}
          </button>
        </div>
      </form>
    </RoomOverlay>
  )
}

export default RoomFormDrawer
