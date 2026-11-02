import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "../services/api";
import { StaffUser } from "../../types";
import { AuthCard, INPUT_CLASS, MicrosoftButton, Notice, PRIMARY_BUTTON_CLASS, useSignInError } from "../components/AuthCard";

interface StaffLoginProps {
  onLogin?: (staff: StaffUser) => void;
}

// Staff sign in with their REVA Microsoft account. The password form is only for the
// emergency administrator account (created on the server with `create-admin`).
const StaffLogin: React.FC<StaffLoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const redirectError = useSignInError();
  const [showEmergency, setShowEmergency] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const staffData = await authService.staffLogin(email.trim(), password);
      onLogin?.(staffData);
      navigate("/staff-dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const shown = error ?? redirectError;

  return (
    <AuthCard title="Staff sign in" subtitle="Use your REVA University Microsoft account (@reva.edu.in).">
      {shown && <Notice kind="error">{shown}</Notice>}
      <MicrosoftButton href={authService.microsoftSignInUrl("staff")} />
      <p className="mt-4 text-xs text-slate-500">
        Staff must be added by an administrator first. Every sign-in is recorded.
      </p>

      <div className="mt-8 border-t border-slate-100 pt-4">
        {!showEmergency ? (
          <button
            type="button"
            onClick={() => setShowEmergency(true)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline underline-offset-4"
          >
            Emergency administrator sign-in
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-slate-500">
              Only for the emergency administrator account, when Microsoft sign-in is unavailable.
            </p>
            <div>
              <label htmlFor="staff-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input id="staff-email" type="email" required autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="staff-password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input id="staff-password" type="password" required autoComplete="current-password" maxLength={128}
                value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT_CLASS} />
            </div>
            <button type="submit" disabled={loading} className={PRIMARY_BUTTON_CLASS}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </button>
            <p className="text-center text-sm">
              <Link to="/forgot-password" className="font-semibold text-brand-600 hover:underline underline-offset-4">Forgot the password?</Link>
            </p>
          </form>
        )}
      </div>
    </AuthCard>
  );
};

export default StaffLogin;
