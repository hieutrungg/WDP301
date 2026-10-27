// TICKET-101: Refund eligibility reads the authoritative check-in state through the Ticket port
// instead of the earlier hard-coded `checkedIn: false` (A-29: checked-in tickets are not
// refundable). Wraps the Refund repository without changing its other methods.
export const withTicketCheckInStatus = (repository, ticketPort) => ({
  ...repository,
  async loadEligibility(bookingId) {
    const data = await repository.loadEligibility(bookingId);
    if (!data) return data;

    const { checkedIn } = await ticketPort.getCheckInStatusByBooking({ bookingId: data.booking._id });
    return { ...data, checkedIn };
  },
});
