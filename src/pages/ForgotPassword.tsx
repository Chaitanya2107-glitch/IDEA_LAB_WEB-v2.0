import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "../services/api";
import { AuthCard, INPUT_CLASS, Notice, PRIMARY_BUTTON_CLASS } from "../components/AuthCard";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authService.forgotPassword(email.trim());
      setMessage(res.message);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="For accounts that sign in with email and password. If you sign in with Microsoft or Google, reset your password there instead."
    >
      {error && <Notice kind="error">{error}</Notice>}
      {message ? (
        <>
          <Notice kind="success">{message} The link is valid for 1 hour. Check your spam folder if you don't see it.</Notice>
          <div className="text-sm">
            <Link to="/login" className="font-semibold text-brand-600 hover:underline underline-offset-4">Back to sign in</Link>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLASS}
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" disabled={loading} className={PRIMARY_BUTTON_CLASS}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
          </button>
          <p className="text-center text-sm text-slate-600">
            Remembered it? <Link to="/login" className="font-semibold text-brand-600 hover:underline underline-offset-4">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
};

export default ForgotPassword;
