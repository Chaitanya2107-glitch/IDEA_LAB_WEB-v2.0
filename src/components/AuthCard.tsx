import React from "react";
import { AnimatePresence, motion } from "framer-motion";

// Shared layout for the sign-in, password and email-link pages.
export const INPUT_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";

export const AuthCard: React.FC<{ title: string; subtitle?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="min-h-screen bg-slate-50 pt-16">
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  </div>
);

export const Notice: React.FC<{ kind: "error" | "success" | "info"; children: React.ReactNode }> = ({ kind, children }) => {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-amber-200 bg-amber-50 text-amber-800",
  }[kind];
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        role={kind === "error" ? "alert" : "status"}
        className={`mb-6 rounded-lg border px-4 py-3 text-sm ${styles}`}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Reads ?token= once and removes it from the address bar and browser history.
export function useLinkToken(): string | null {
  const [token] = React.useState(() => new URLSearchParams(window.location.search).get("token"));
  React.useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);
  return token;
}

// Standard "Sign in with Microsoft" button (Microsoft's four-square mark).
export const MicrosoftButton: React.FC<{ href: string; label?: string }> = ({ href, label = "Sign in with Microsoft" }) => {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        window.location.assign(href);
      }}
      className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
    >
      <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
      {busy ? "Opening Microsoft…" : label}
    </button>
  );
};

// Standard "Sign in with Google" button (Google's four-colour G).
export const GoogleButton: React.FC<{ href: string; label?: string }> = ({ href, label = "Sign in with Google" }) => {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        window.location.assign(href);
      }}
      className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {busy ? "Opening Google…" : label}
    </button>
  );
};

// Why the server sent the person back to the sign-in page (?error=...).
const SIGN_IN_ERRORS: Record<string, string> = {
  domain: "Only REVA University Microsoft accounts (@reva.edu.in) can sign in. Personal Microsoft, Gmail and other accounts are not allowed.",
  not_staff: "This Microsoft account is not on the staff list. Ask an administrator to add you, or use the student sign-in.",
  staff_disabled: "Your staff access has been turned off. Contact an administrator.",
  account_mismatch: "This email is linked to a different Microsoft account. Contact the IDEA Lab administrator.",
  cancelled: "Sign-in was cancelled.",
  expired: "The sign-in took too long or was opened in another browser. Please try again.",
  not_configured: "Microsoft sign-in has not been set up on this server yet.",
  failed: "Sign-in failed. Please try again.",
  use_microsoft: "REVA accounts (@reva.edu.in) sign in with Microsoft. Use the \"Sign in with Microsoft\" button.",
  google_unverified: "This Google account's email address is not verified by Google.",
  google_not_configured: "Google sign-in has not been set up on this server yet.",
};

// Reads ?error= once, removes it from the address bar and returns a readable message.
export function useSignInError(): string | null {
  const [code] = React.useState(() => new URLSearchParams(window.location.search).get("error"));
  React.useEffect(() => {
    if (code) window.history.replaceState(null, "", window.location.pathname);
  }, [code]);
  return code ? SIGN_IN_ERRORS[code] ?? SIGN_IN_ERRORS.failed : null;
}
