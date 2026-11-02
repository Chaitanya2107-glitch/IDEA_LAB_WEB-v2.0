// src/App.tsx

import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import DashboardNavbar from "./components/DashboardNavbar";
import Footer from "./components/Footer";
import FloatingLoginBtn from "./components/FloatingLoginBtn";
import OnboardingPage from "./pages/OnboardingPage";
import ProgressBar from "./components/ProgressBar";

import Home from "./pages/Home";
import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails";
import Gallery from "./pages/Gallery";
import Components from "./pages/Components";
import Print3D from "./pages/Print3D";
import PcbOrderPage from "./pages/PcbOrder";
import { UserDashboard } from "./pages/UserDashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import StaffLogin from "./pages/StaffLogin";
import StaffDashboard from "./pages/StaffDashboard";
import About from "./pages/About";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import Resources from "./pages/Resources";
import Testimonials from "./pages/Testimonials";
import Infrastructure from "./pages/Infrastructure";
import SlotBooking from "./pages/SlotBooking";

import { User, StaffUser } from "../types";
import { authService } from "./services/api";
import { Loader2 } from "lucide-react";
import { MotionConfig } from "framer-motion";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthComplete from "./pages/AuthComplete";

/* -------------------- Scroll Control -------------------- */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

/* -------------------- Guards -------------------- */
const UserRoute = ({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) => (user ? <>{children}</> : <Navigate to="/login" replace />);

const StaffRoute = ({
  staff,
  children,
}: {
  staff: StaffUser | null;
  children: React.ReactNode;
}) => (staff ? <>{children}</> : <Navigate to="/staff-login" replace />);

/* ============================================================ */
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  /* ---------------- Restore session once ---------------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const session = await authService.getCurrentSession();
        if (!mounted) return;
        setUser(session.user);
        setStaffUser(session.staff);
      } finally {
        if (mounted) setAuthReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------- Logout ---------------- */
  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setStaffUser(null);
  };

  /* ---------------- Profile updates ---------------- */
  const handleProfileComplete = (updated: User) => {
    // Always mark complete locally first — don't block on API response
    setUser({ ...updated, isProfileComplete: true });
    authService.updateProfile({ ...updated, isProfileComplete: true }).then(saved => {
      setUser({ ...saved, isProfileComplete: true });
    }).catch(() => {/* non-fatal */});
  };

  const handleUserUpdate = async (data: { name: string; avatar: string }) => {
    if (staffUser) {
      const updated = { ...staffUser, ...data };
      await authService.updateStaffProfile(updated);
      setStaffUser(updated);
    } else if (user) {
      const updated = { ...user, ...data };
      await authService.updateProfile(updated);
      setUser(updated);
    }
  };

/* -------------------- Navbar Wrapper -------------------- */
const NavbarWrapper = ({ user, staffUser, onLogout, onUpdateUser }: any) => {
  const location = useLocation();
  const isDashboard = ["/dashboard", "/staff-dashboard", "/login", "/register", "/verify-email", "/staff-login", "/forgot-password", "/reset-password", "/auth/complete"].includes(location.pathname);

  if (isDashboard) {
    return (
      <DashboardNavbar
        user={user}
        staffUser={staffUser}
        onLogout={onLogout}
        onUpdateUser={onUpdateUser}
      />
    );
  }

  return (
    <Navbar
      user={user}
      staffUser={staffUser}
      onLogout={onLogout}
      onUpdateUser={onUpdateUser}
    />
  );
};

  /* ---------------- Block UI until auth resolved ---------------- */
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <Router>
      <ScrollToTop />
      <ProgressBar />

      <div className="flex flex-col min-h-screen">
        <NavbarWrapper
          user={user}
          staffUser={staffUser}
          onLogout={handleLogout}
          onUpdateUser={handleUserUpdate}
        />



        <main className="flex-grow">
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<Events user={user || undefined} />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/about" element={<About />} />
            <Route path="/team" element={<Navigate to="/about" replace />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/testimonials" element={<Testimonials />} />
            <Route path="/infrastructure" element={<Infrastructure />} />

            {/* Auth */}
            <Route
              path="/login"
              element={
                user
                  ? <Navigate to="/dashboard" replace />
                  : <Login onLogin={(u) => { setStaffUser(null); setUser(u); }} />
              }
            />
            <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
            <Route path="/verify-email" element={<VerifyEmail onLogin={(u) => { setStaffUser(null); setUser(u); }} />} />

            {/* Back from Microsoft sign-in */}
            <Route path="/auth/complete" element={<AuthComplete onUser={(u) => { setStaffUser(null); setUser(u); }} onStaff={(s) => { setUser(null); setStaffUser(s); }} />} />

            {/* Password reset (emailed link): email + password accounts and the emergency administrator */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Onboarding */}
            <Route
              path="/onboarding"
              element={
                user
                  ? <Navigate to="/dashboard" replace />
                  : <Navigate to="/login" replace />
              }
            />

            <Route
              path="/staff-login"
              element={
                staffUser ? (
                  <Navigate to="/staff-dashboard" replace />
                ) : (
                  <StaffLogin onLogin={setStaffUser} />
                )
              }
            />

            {/* User */}
            <Route
              path="/dashboard"
              element={
                <UserRoute user={user}>
                  <UserDashboard user={user || undefined} />
                </UserRoute>
              }
            />

            <Route
              path="/components"
              element={
                <UserRoute user={user}>
                  <Components user={user || undefined} />
                </UserRoute>
              }
            />

            <Route
              path="/3d-print"
              element={
                <UserRoute user={user}>
                  <Print3D user={user || undefined} />
                </UserRoute>
              }
            />

            <Route
              path="/pcb-order"
              element={
                <UserRoute user={user}>
                  <PcbOrderPage user={user || undefined} />
                </UserRoute>
              }
            />

            <Route
              path="/slot-booking"
              element={
                <UserRoute user={user}>
                  <SlotBooking user={user || undefined} />
                </UserRoute>
              }
            />

            {/* Staff */}
            <Route
              path="/staff-dashboard"
              element={
                <StaffRoute staff={staffUser}>
                  <StaffDashboard staff={staffUser} />
                </StaffRoute>
              }
            />
          </Routes>
        </main>

        <Footer />
        {!user && !staffUser && <FloatingLoginBtn />}
      </div>
    </Router>
    </MotionConfig>
  );
};

export default App;
