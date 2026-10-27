import { ArrowLeft, Compass, House, ShieldAlert } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import AppLogo from "../../components/common/AppLogo";
import { useAuth } from "../../features/auth/hooks/useAuth";
import {
  getHighestPriorityRole,
  getRoleWorkspaceMeta,
} from "../../features/auth/utils/loginDestination";

const WORKSPACE_LANDING_PATHS = {
  "/admin": new Set(["/admin", "/admin/branches"]),
  "/manager": new Set(["/manager", "/manager/showtimes"]),
  "/staff/dashboard": new Set(["/staff", "/staff/dashboard"]),
  "/": new Set(["/"]),
};

function ForbiddenPage({ standalone = false }) {
  const { account, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const primaryRole = getHighestPriorityRole(account);
  const workspace = getRoleWorkspaceMeta(account);
  const isAlreadyAtWorkspace = Boolean(
    WORKSPACE_LANDING_PATHS[workspace.path]?.has(location.pathname),
  );

  const primaryDestination = isAlreadyAtWorkspace ? "/" : workspace.path;
  const primaryLabel = isAlreadyAtWorkspace ? "Back to Home" : workspace.label;

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <section
      aria-labelledby="forbidden-page-title"
      className={`flex w-full items-center justify-center bg-background px-4 py-12 text-on-surface sm:px-6 lg:px-8 ${
        standalone ? "min-h-screen" : "min-h-[calc(100vh-9rem)]"
      }`}
    >
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-surface-container-low p-6 shadow-2xl sm:p-10">
        {standalone && (
          <div className="mb-8 flex items-center justify-between border-b border-white/5 pb-5">
            <AppLogo />
            {isAuthenticated && primaryRole && (
              <span className="rounded-full border border-white/10 bg-surface-container px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-secondary">
                {primaryRole}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col items-start">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-container/15 text-primary shadow-crimson">
              <ShieldAlert className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Error 403 &bull; Forbidden
              </p>
              <p className="text-xs text-on-surface-variant">
                Role &amp; permission boundary enforced
              </p>
            </div>
          </div>

          <h1
            id="forbidden-page-title"
            className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
          >
            Access Denied
          </h1>

          <p className="mt-3 text-sm leading-6 text-on-surface-variant sm:text-base">
            Your current account does not have the required role or permission
            to access this area. Your session remains active and you can safely
            return to an authorized workspace.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to={primaryDestination}
              replace
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-bold text-white shadow-crimson transition hover:opacity-95"
            >
              {primaryDestination === "/" ? (
                <House className="size-4" aria-hidden="true" />
              ) : (
                <Compass className="size-4" aria-hidden="true" />
              )}
              {primaryLabel}
            </Link>

            {primaryDestination !== "/" && (
              <Link
                to="/"
                replace
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-surface-container px-5 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high hover:text-white"
              >
                <House className="size-4" aria-hidden="true" />
                Back to Home
              </Link>
            )}

            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-surface-container px-4 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high hover:text-white"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ForbiddenPage;
