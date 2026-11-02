import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "../services/api";
import { StaffUser, User } from "../../types";
import { AuthCard, Notice } from "../components/AuthCard";

interface AuthCompleteProps {
  onUser: (user: User) => void;
  onStaff: (staff: StaffUser) => void;
}

// Microsoft sends the browser back here with a one-time code in the address fragment
// (#code=...), which is exchanged for a session.
const AuthComplete: React.FC<AuthCompleteProps> = ({ onUser, onStaff }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      setError("This sign-in link is not valid. Please sign in again.");
      return;
    }
    authService
      .completeMicrosoftSignIn(code)
      .then(({ user, staff, next }) => {
        if (staff) {
          onStaff(staff);
          navigate(next ?? "/staff-dashboard", { replace: true });
        } else if (user) {
          onUser(user);
          navigate(next ?? "/dashboard", { replace: true });
        }
      })
      .catch((err) => setError(err.message || "Sign-in failed. Please try again."));
  }, [navigate, onStaff, onUser]);

  if (error) {
    return (
      <AuthCard title="Sign-in problem">
        <Notice kind="error">{error}</Notice>
        <p className="text-sm">
          <Link to="/login" className="font-semibold text-brand-600 hover:underline underline-offset-4">Student sign in</Link>
          {" · "}
          <Link to="/staff-login" className="font-semibold text-brand-600 hover:underline underline-offset-4">Staff sign in</Link>
        </p>
      </AuthCard>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
      <span className="sr-only">Signing you in</span>
    </div>
  );
};

export default AuthComplete;
