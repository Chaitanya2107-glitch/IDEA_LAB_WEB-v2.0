import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "../services/api";
import { User } from "../../types";
import { AuthCard, INPUT_CLASS, Notice, PRIMARY_BUTTON_CLASS, useLinkToken } from "../components/AuthCard";

// Opened from the sign-up email. The link only works together with the password chosen
// at sign-up, so a link sent to the wrong person can't be used by them.
const VerifyEmail: React.FC<{ onLogin?: (user: User) => void }> = ({ onLogin }) => {
  const token = useLinkToken();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authService.verifyEmail(token!, password);
      onLogin?.(user);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Could not confirm your email.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Link not valid">
        <Notice kind="error">This confirmation link is incomplete. Please sign up again.</Notice>
        <Link to="/register" className={PRIMARY_BUTTON_CLASS}>Sign up</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirm your email" subtitle="Enter the password you chose when you signed up to finish creating your account.">
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="verify-password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
          <input id="verify-password" type="password" required maxLength={128} autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={INPUT_CLASS} />
        </div>
        <button type="submit" disabled={loading} className={PRIMARY_BUTTON_CLASS}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm and sign in"}
        </button>
      </form>
    </AuthCard>
  );
};

export default VerifyEmail;
