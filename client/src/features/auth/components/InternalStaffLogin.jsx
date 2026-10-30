import {
  Building2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getApiErrorMessage } from "../../../lib/api/apiError";
import { getPublicCinemas } from "../../../lib/api/publicCinemaApi";
import {
  getCurrentAccountRequest,
  internalStaffGoogleLoginRequest,
  internalStaffLoginRequest,
} from "../api/authApi";
import { useAuthStore } from "../store/authStore";
import { AuthInput, AuthServerError, PasswordInput } from "./AuthFormField";
import GoogleCredentialButton from "./GoogleCredentialButton";

export default function InternalStaffLogin({ onClose }) {
  const navigate = useNavigate();
  const setAccount = useAuthStore((state) => state.setAccount);
  const [cinemas, setCinemas] = useState([]);
  const [form, setForm] = useState({
    branchId: "",
    identity: "",
    password: "",
    rememberMe: false,
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getPublicCinemas({ page: 1, limit: 50 }, controller.signal)
      .then(({ items }) => {
        setCinemas(items);
        setForm((current) => ({
          ...current,
          branchId: current.branchId || items[0]?.id || "",
        }));
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(getApiErrorMessage(requestError));
      });
    return () => controller.abort();
  }, []);

  const finish = async () => {
    const account = await getCurrentAccountRequest();
    setAccount(account);
    navigate("/staff/dashboard", { replace: true });
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await internalStaffLoginRequest(form);
      await finish();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };
  const google = async (credential) => {
    setBusy(true);
    setError("");
    try {
      await internalStaffGoogleLoginRequest({
        credential,
        branchId: form.branchId,
        rememberMe: form.rememberMe,
      });
      await finish();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="internal-login-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-white/5 bg-surface-container-low p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close internal sign in"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg bg-surface-container-high"
        >
          <X className="size-4" />
        </button>
        <div className="mb-6 pr-10">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-secondary">
            <ShieldCheck className="size-4" />
            Secure internal access
          </div>
          <h2
            id="internal-login-title"
            className="font-heading text-2xl font-bold text-white sm:text-[28px]"
          >
            Internal Sign In
          </h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Choose your assigned cinema and enter your Staff or Manager
            credentials.
          </p>
        </div>
        <AuthServerError message={error} />
        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Cinema</span>
            <span className="relative block">
              <Building2 className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-on-surface-variant" />
              <select
                required
                value={form.branchId}
                onChange={(event) =>
                  setForm({ ...form, branchId: event.target.value })
                }
                className="h-12 w-full rounded-lg bg-surface-container pl-11 pr-4 text-sm outline-none"
              >
                {cinemas.map((cinema) => (
                  <option key={cinema.id} value={cinema.id}>
                    {cinema.branchName}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <AuthInput
            id="internal-identity"
            label="Email or username"
            icon={UserRound}
            autoComplete="username"
            value={form.identity}
            onChange={(event) =>
              setForm({ ...form, identity: event.target.value })
            }
          />
          <PasswordInput
            id="internal-password"
            label="Password"
            labelAction={
              <Link
                to="/forgot-password"
                onClick={onClose}
                className="text-xs text-primary"
              >
                Forgot password?
              </Link>
            }
            icon={LockKeyhole}
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((value) => !value)}
            autoComplete="current-password"
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
          />
          <label className="flex items-center gap-2 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              checked={form.rememberMe}
              onChange={(event) =>
                setForm({ ...form, rememberMe: event.target.checked })
              }
              className="size-4 accent-primary-container"
            />
            Remember me
          </label>
          <button
            disabled={busy || !form.branchId}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-primary-container text-sm font-bold text-white shadow-crimson-strong disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <div className="my-6 flex items-center gap-4 text-xs text-on-surface-variant">
          <span className="h-px flex-1 bg-surface-container-highest" />
          or continue with
          <span className="h-px flex-1 bg-surface-container-highest" />
        </div>
        <GoogleCredentialButton
          onCredential={google}
          disabled={busy || !form.branchId}
        />
      </div>
    </div>
  );
}
