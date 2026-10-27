import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  getRoleRequest,
  getStaffAccountRequest,
  getStaffFormOptionsRequest,
  listPermissionsRequest,
  listRolesRequest,
  listStaffAccountsRequest,
} from '../api/accessControlApi'

export const accessControlKeys = {
  all: ['access-control'],
  permissions: ['access-control', 'permissions'],
  roles: (params) => ['access-control', 'roles', params],
  role: (roleId) => ['access-control', 'role', roleId],
  staffList: (params) => ['access-control', 'staff', params],
  staff: (accountId) => ['access-control', 'staff-detail', accountId],
  staffOptions: ['access-control', 'staff-options'],
}

export function usePermissionCatalog() {
  return useQuery({ queryKey: accessControlKeys.permissions, queryFn: listPermissionsRequest, staleTime: 5 * 60_000 })
}

export function useRoleList(params) {
  return useQuery({
    queryKey: accessControlKeys.roles(params),
    queryFn: () => listRolesRequest(params),
    placeholderData: keepPreviousData,
  })
}

export function useRoleDetail(roleId) {
  return useQuery({
    queryKey: accessControlKeys.role(roleId),
    queryFn: () => getRoleRequest(roleId),
    enabled: Boolean(roleId),
  })
}

export function useStaffList(params) {
  return useQuery({
    queryKey: accessControlKeys.staffList(params),
    queryFn: () => listStaffAccountsRequest(params),
    placeholderData: keepPreviousData,
  })
}

export function useStaffDetail(accountId) {
  return useQuery({
    queryKey: accessControlKeys.staff(accountId),
    queryFn: () => getStaffAccountRequest(accountId),
    enabled: Boolean(accountId),
  })
}

export function useStaffFormOptions() {
  return useQuery({ queryKey: accessControlKeys.staffOptions, queryFn: getStaffFormOptionsRequest })
}

// Every mutation refreshes all access-control reads: role counts, staff lists and details.
export function useRefreshAccessControl() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.invalidateQueries({ queryKey: accessControlKeys.all }), [queryClient])
}
