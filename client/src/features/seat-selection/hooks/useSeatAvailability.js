import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acquireSeatHold,
  getSeatAvailability,
  releaseSeatHold,
} from '../api/seatHoldApi'

const seatAvailabilityKey = (showtimeId) => ['seat-availability', showtimeId]

export function useSeatAvailability(showtimeId) {
  return useQuery({
    queryKey: seatAvailabilityKey(showtimeId),
    queryFn: ({ signal }) => getSeatAvailability(showtimeId, signal),
    enabled: Boolean(showtimeId),
    refetchOnWindowFocus: true,
  })
}

export function useAcquireSeatHold(showtimeId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acquireSeatHold,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: seatAvailabilityKey(showtimeId) }),
  })
}

export function useReleaseSeatHold(showtimeId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: releaseSeatHold,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: seatAvailabilityKey(showtimeId) }),
  })
}

