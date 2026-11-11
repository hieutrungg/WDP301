import { Building2, ShieldCheck, UserRoundCheck } from "lucide-react";
import AuthPageShell from "../../features/auth/components/AuthPageShell";
import InternalStaffLogin from "../../features/auth/components/InternalStaffLogin";

const benefits = [
  { icon: Building2, text: "Access your assigned cinema workspace" },
  { icon: ShieldCheck, text: "Admin, Staff and Manager access" },
  { icon: UserRoundCheck, text: "Continue securely to internal operations" },
];

function InternalLoginPage() {
  return (
    <AuthPageShell
      eyebrow={
        <>
          <ShieldCheck className="size-4" /> Internal operations
        </>
      }
      title="Secure access for your cinema team."
      description="Admins can enter the system workspace directly; Staff and Managers choose their assigned cinema."
      benefits={benefits}
    >
      <InternalStaffLogin />
    </AuthPageShell>
  );
}

export default InternalLoginPage;
