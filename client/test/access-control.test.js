import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createStaffSchema,
  emptyStaffForm,
  roleInfoSchema,
} from '../src/features/access-control/schema/accessControlSchemas.js'
import {
  affectedAccountsMessage,
  changedFields,
  effectivePermissionIds,
  formatAdminDateTime,
  groupPermissions,
  inheritedPermissionMap,
  redundancyLabel,
  roleSaveConfirmations,
  sameIdSet,
  toggleId,
} from '../src/features/access-control/utils/accessControl.js'

const permissions = [
  { id: 'p1', name: 'movie.view', description: 'View movies', group: 'movie' },
  { id: 'p2', name: 'movie.create', description: 'Create movies', group: 'movie' },
  { id: 'p3', name: 'ticket.validate', description: 'Validate tickets', group: 'ticket' },
  { id: 'p4', name: 'report.view', description: 'View reports', group: 'report' },
]
const roles = [
  { id: 'r-staff', name: 'STAFF', permissionIds: ['p1', 'p3'] },
  { id: 'r-manager', name: 'MANAGER', permissionIds: ['p1', 'p2'] },
]

test('permissions are grouped by module and searchable (BR-33 list)', () => {
  const groups = groupPermissions(permissions)
  assert.deepEqual(groups.map(({ label }) => label), ['Movies', 'Reports', 'Tickets'])
  assert.deepEqual(groups[0].permissions.map(({ name }) => name), ['movie.create', 'movie.view'])
  assert.deepEqual(groupPermissions(permissions, 'validate').map(({ group }) => group), ['ticket'])
})

test('UC37 4a: a direct grant already provided by a selected role is flagged, not removed', () => {
  const inherited = inheritedPermissionMap(roles, ['r-staff', 'r-manager'])
  assert.deepEqual(inherited.get('p1'), ['STAFF', 'MANAGER'])
  assert.equal(inherited.has('p4'), false)
  assert.equal(redundancyLabel(inherited.get('p3')), 'Already granted via assigned role (STAFF)')
  assert.equal(redundancyLabel([]), '')
  // Unselected roles never count.
  assert.equal(inheritedPermissionMap(roles, ['r-staff']).has('p2'), false)
})

test('A-08: effective permissions are the union of role and direct grants', () => {
  assert.deepEqual(effectivePermissionIds(roles, ['r-staff'], ['p3', 'p4']), ['p1', 'p3', 'p4'])
  assert.deepEqual(effectivePermissionIds(roles, [], []), [])
})

test('CR-05: role saves ask before no permissions and before affecting active accounts', () => {
  assert.deepEqual(roleSaveConfirmations({ permissionIds: [], activeAccountCount: 0 }), ['noPermissions'])
  assert.deepEqual(roleSaveConfirmations({ permissionIds: ['p1'], activeAccountCount: 3 }), ['affectedAccounts'])
  assert.deepEqual(roleSaveConfirmations({ permissionIds: [], activeAccountCount: 1 }), ['noPermissions', 'affectedAccounts'])
  assert.deepEqual(roleSaveConfirmations({ permissionIds: undefined, activeAccountCount: 0 }), [])
  assert.match(affectedAccountsMessage(1), /1 active account\. The change will immediately affect it\./)
  assert.match(affectedAccountsMessage(4), /4 active accounts/)
})

test('id helpers compare sets and toggle selections', () => {
  assert.equal(sameIdSet(['a', 'b'], ['b', 'a']), true)
  assert.equal(sameIdSet(['a'], ['a', 'b']), false)
  assert.deepEqual(toggleId(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b'])
  assert.deepEqual(changedFields({ a: 1, b: 2 }, { a: 1, b: 3 }, ['a', 'b']), { b: 2 })
})

test('admin timestamps use dd/MM/yyyy HH:mm in Asia/Ho_Chi_Minh', () => {
  assert.equal(formatAdminDateTime('2026-10-27T17:05:00.000Z'), '28/10/2026 00:05')
  assert.equal(formatAdminDateTime(null), '—')
})

test('UC35 form uses SRS 5.3 messages and requires a role (BR-27)', () => {
  const result = createStaffSchema.safeParse({ ...emptyStaffForm, email: 'nope', username: 'a$', phone: '12' })
  assert.equal(result.success, false)
  const messages = Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]))
  assert.equal(messages.fullName, 'The Full name field is required.')
  assert.equal(messages.email, 'The Email format is invalid.')
  assert.equal(messages.phone, 'The Phone number format is invalid.')
  assert.equal(messages.roleIds, 'At least one role is required.')

  const valid = createStaffSchema.safeParse({
    ...emptyStaffForm,
    fullName: 'Linh Tran',
    email: 'linh@example.com',
    username: 'linh_tran',
    phone: '090 222 3333',
    roleIds: ['r-staff'],
  })
  assert.equal(valid.success, true)
})

test('UC45 role names: required, max 50 and a safe format', () => {
  const issue = (name) => roleInfoSchema.safeParse({ name, description: '' }).error?.issues[0]?.message
  assert.equal(issue(''), 'The Role name field is required.')
  assert.equal(issue('x'.repeat(51)), 'Exceed max length of 50.')
  assert.equal(issue('Box@Office'), 'The Role name format is invalid.')
  assert.equal(issue('Ticket Checker'), undefined)
})
