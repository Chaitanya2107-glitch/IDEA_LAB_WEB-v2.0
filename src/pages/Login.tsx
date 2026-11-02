// src/pages/Login.tsx — REVA students sign in with Microsoft, visitors with Google, and
// anyone can also use an email + password account.

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "../services/api";
import { User } from "../../types";
import { AuthCard, GoogleButton, INPUT_CLASS, MicrosoftButton, Notice, PRIMARY_BUTTON_CLASS, useSignInError } from "../components/AuthCard";

interface LoginProps {
  onLogin?: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const redirectError = useSignInError();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authService.passwordLogin(email.trim(), password);
      onLogin?.(user);
      navigate(from ?? "/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const shown = error ?? redirectError;

  return (
    <AuthCard title="Sign in" subtitle="REVA students with Microsoft, visitors with Google, or your email and password.">
      {shown && <Notice kind="error">{shown}</Notice>}
      <MicrosoftButton href={authService.microsoftSignInUrl("student", from)} />
      <p className="mt-2 text-xs text-slate-500">
        REVA students: use your <span className="font-semibold text-slate-700">@reva.edu.in</span> account for full university access.
      </p>

      <div className="mt-4">
        <GoogleButton href={authService.googleSignInUrl(from)} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Visitors from outside REVA: general access (events, 3D printing, PCB orders).
      </p>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or with email <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input id="login-email" type="email" required autoComplete="username" maxLength={254} value={email}
            onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 hover:underline underline-offset-4">Forgot password?</Link>
          </div>
          <input id="login-password" type="password" required autoComplete="current-password" maxLength={128} value={password}
            onChange={(e) => setPassword(e.target.value)} className={INPUT_CLASS} />
        </div>
        <button type="submit" disabled={loading} className={PRIMARY_BUTTON_CLASS}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        No account yet? <Link to="/register" className="font-semibold text-brand-600 hover:underline underline-offset-4">Create one with your email</Link>
      </p>

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        Signed up with Microsoft or Google? Keep using that button. Every sign-in is recorded for the lab's usage records.
      </p>
    </AuthCard>
  );
};

export default Login;
