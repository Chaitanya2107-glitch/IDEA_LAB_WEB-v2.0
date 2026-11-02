import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "../services/api";
import { AuthCard, INPUT_CLASS, Notice, PRIMARY_BUTTON_CLASS } from "../components/AuthCard";

// Email + password sign-up. The account is created when the emailed link is opened.
const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      setMessage((await authService.register(name.trim(), email.trim(), password)).message);
    } catch (err: any) {
      setError(err.message || "Could not sign up. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <AuthCard title="Check your email">
        <Notice kind="success">{message}</Notice>
        <p className="text-sm text-slate-600">
          Open the link in the email and enter the password you just chose. Check your spam folder if you don't see it.
        </p>
        <p className="mt-6 text-sm">
          <Link to="/login" className="font-semibold text-brand-600 hover:underline underline-offset-4">Back to sign in</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create an account"
      subtitle={<>REVA students get full university access with their <span className="font-semibold">@reva.edu.in</span> email; other emails get general access.</>}
    >
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
          <input id="reg-name" required autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input id="reg-email" type="email" required autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
          <input id="reg-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={INPUT_CLASS} placeholder="At least 8 characters" />
        </div>
        <div>
          <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-medium text-slate-700">Repeat password</label>
          <input id="reg-confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className={INPUT_CLASS} />
        </div>
        <button type="submit" disabled={loading} className={PRIMARY_BUTTON_CLASS}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:underline underline-offset-4">Sign in</Link>
      </p>
    </AuthCard>
  );
};

export default Register;
