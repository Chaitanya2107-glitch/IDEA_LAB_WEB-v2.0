import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "../services/api";
import { AuthCard, INPUT_CLASS, Notice, PRIMARY_BUTTON_CLASS, useLinkToken } from "../components/AuthCard";

const ResetPassword: React.FC = () => {
  const token = useLinkToken();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; account: "user" | "staff" } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      setDone(await authService.resetPassword(token!, password));
    } catch (err: any) {
      setError(err.message || "Could not update the password.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Link not valid">
        <Notice kind="error">This password reset link is incomplete. Please request a new one.</Notice>
        <Link to="/forgot-password" className={PRIMARY_BUTTON_CLASS}>Request a new link</Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <Notice kind="success">{done.message}</Notice>
        <Link to={done.account === "staff" ? "/staff-login" : "/login"} className={PRIMARY_BUTTON_CLASS}>
          Go to {done.account === "staff" ? "staff" : "student"} login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Use at least 8 characters. Avoid passwords you use on other sites.">
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
          <input
            id="reset-password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="reset-confirm" className="mb-1.5 block text-sm font-medium text-slate-700">Repeat new password</label>
          <input
            id="reset-confirm"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <button type="submit" disabled={loading} className={PRIMARY_BUTTON_CLASS}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set new password"}
        </button>
      </form>
    </AuthCard>
  );
};

export default ResetPassword;
