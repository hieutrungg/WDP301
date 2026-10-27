import {
  Armchair,
  Building2,
  BriefcaseBusiness,
  CircleDollarSign,
  DoorOpen,
  History,
  Ticket,
  UserRound,
} from "lucide-react";

// `permission` / `role` only hide navigation; the API still enforces access.
export const userMenuItems = [
  { label: "My Profile", to: "/profile", icon: UserRound },
  { label: "My Tickets", to: "/my-tickets", icon: Ticket },
  { label: "Booking History", to: "/booking-history", icon: History },
  {
    label: "Cancellation & Refund",
    to: "/refunds",
    icon: CircleDollarSign,
    role: "CUSTOMER",
  },
  // Way back to the role workspace from the public pages (home is no longer a forced redirect).
  {
    label: "Manager Workspace",
    to: "/manager",
    icon: BriefcaseBusiness,
    role: "MANAGER",
  },
  {
    label: "Staff Workspace",
    to: "/staff/dashboard",
    icon: BriefcaseBusiness,
    role: "STAFF",
  },
  {
    label: "Branch Management",
    to: "/admin/branches",
    icon: Building2,
    permission: "branch.manage",
    role: "ADMIN",
  },
  {
    label: "Room Management",
    to: "/admin/rooms",
    icon: DoorOpen,
    permission: "room.view",
    role: "ADMIN",
  },
  {
    label: "Room Management",
    to: "/manager/rooms",
    icon: DoorOpen,
    permission: "room.manage",
    role: "MANAGER",
  },
  {
    label: "Room Seat Maps",
    to: "/manager/seat-maps",
    icon: Armchair,
    permission: "room.manage",
    role: "MANAGER",
  },
];

export const getUserMenuItems = (account) =>
  userMenuItems.filter(
    ({ permission, role }) =>
      (!permission ||
        account?.permissions?.some(({ name }) => name === permission)) &&
      (!role || account?.roles?.some(({ name }) => name === role)),
  );
