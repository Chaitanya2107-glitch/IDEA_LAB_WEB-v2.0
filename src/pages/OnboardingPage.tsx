// src/pages/OnboardingPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "../../types";
import { authService } from "../services/api";
import { ChevronRight, ArrowLeft, CheckCircle, Loader2, ChevronDown } from "lucide-react";

interface OnboardingPageProps {
  user: User;
  onComplete: (updated: User) => void;
}

/* ── Data ── */
const DEGREES = ["B.Tech", "M.Tech", "MBA", "PhD", "B.Sc", "M.Sc", "Faculty", "Other"];

const PROGRAMS: Record<string, string[]> = {
  "B.Tech": ["Computer Science & Engineering", "Electronics & Communication", "Mechanical Engineering", "Civil Engineering", "Electrical Engineering", "Information Technology", "AI & Machine Learning", "Data Science", "Biotechnology"],
  "M.Tech": ["Computer Science", "VLSI Design", "Structural Engineering", "Power Systems", "Robotics & Automation", "AI & Machine Learning", "Signal Processing"],
  "MBA":    ["Finance", "Marketing", "Operations Management", "Human Resources", "Business Analytics", "Entrepreneurship"],
  "PhD":    ["Computer Science", "Electronics", "Mechanical", "Management Studies", "Physics", "Chemistry"],
  "B.Sc":   ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science", "Statistics"],
  "M.Sc":   ["Physics", "Chemistry", "Mathematics", "Computer Science", "Data Science"],
  "Faculty":["Computer Science", "Electronics", "Mathematics", "Physics", "Management", "Mechanical"],
  "Other":  ["Not Applicable"],
};

const SEMESTERS = ["1st Semester", "2nd Semester", "3rd Semester", "4th Semester", "5th Semester", "6th Semester", "7th Semester", "8th Semester"];
const NO_SEMESTER_ROLES = ["Faculty", "PhD", "Other"];

/* ── Custom Select ── */
const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}> = ({ label, value, onChange, options, placeholder = "Select an option" }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {label}
      <span className="relative mt-1.5 block">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="block w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-normal text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        >
          <option value="" disabled>{placeholder}</option>
          {options.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      </span>
    </label>
  </div>
);

/* ── Step progress bar ── */
const ProgressBar: React.FC<{ step: number; total: number }> = ({ step, total }) => (
  <div className="mb-8 flex gap-2" aria-hidden="true">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className="h-full rounded-full bg-brand-500"
          initial={{ width: 0 }}
          animate={{ width: i < step ? "100%" : i === step - 1 ? "100%" : "0%" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    ))}
  </div>
);

/* ═══════════ MAIN PAGE ═══════════ */
const OnboardingPage: React.FC<OnboardingPageProps> = ({ user, onComplete }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [degree, setDegree] = useState("");
  const [program, setProgram] = useState("");
  const [semester, setSemester] = useState("");
  const [saving, setSaving] = useState(false);

  const hasSemester = degree && !NO_SEMESTER_ROLES.includes(degree);
  const totalSteps = hasSemester ? 3 : 2;

  const valid = () => {
    if (step === 1) return !!degree;
    if (step === 2) return !!program;
    if (step === 3) return !!semester;
    return true;
  };

  const programs = degree ? PROGRAMS[degree] ?? [] : [];

  const handleNext = () => {
    if (step === 1) { setProgram(""); setDegree(degree); }
    if (step < totalSteps) { setStep(s => s + 1); return; }
    handleFinish();
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Saved to users + profiles by the API
      await authService.updateProfile({
        ...user,
        degree,
        program,
        semester: hasSemester ? semester : null,
        isProfileComplete: true,
      } as any).catch(() => {});
    } catch { /* non-fatal */ }

    onComplete({ ...user, degree, program, isProfileComplete: true });
    navigate("/dashboard", { replace: true });
  };

  const stepVariants = {
    enter:  { opacity: 0, y: 10 },
    center: { opacity: 1, y: 0 },
    exit:   { opacity: 0, y: -10 },
  };

  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-slate-50 pt-16">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mb-8 text-center"
          >
            <span className="block text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">Step {step} of {totalSteps}</span>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {step === 1 && `Welcome, ${firstName}`}
              {step === 2 && "Specialization"}
              {step === 3 && "Semester Status"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {step === 1 && "Start by identifying your academic path."}
              {step === 2 && `Choose your specific major in ${degree}.`}
              {step === 3 && "Help us personalize your dashboard schedule."}
            </p>
          </motion.div>

          {/* Form Area */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <ProgressBar step={step} total={totalSteps} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {step === 1 && (
                  <Select
                    label="Academic Background"
                    value={degree}
                    onChange={setDegree}
                    options={DEGREES}
                    placeholder="Choose your path"
                  />
                )}

                {step === 2 && (
                  <Select
                    label="Departmental Program"
                    value={program}
                    onChange={setProgram}
                    options={programs}
                    placeholder="Choose your program"
                  />
                )}

                {step === 3 && (
                  <Select
                    label="Current Academic Year"
                    value={semester}
                    onChange={setSemester}
                    options={SEMESTERS}
                    placeholder="Select current semester"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex items-center gap-3">
              {step > 1 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  aria-label="Back"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!valid() || saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step < totalSteps ? (
                  <>Next Step <ChevronRight className="h-4 w-4" aria-hidden="true" /></>
                ) : (
                  <><CheckCircle className="h-4 w-4" aria-hidden="true" /> Finalize Profile</>
                )}
              </button>
            </div>

            <button
              onClick={() => {
                onComplete({ ...user, isProfileComplete: true });
                navigate("/dashboard", { replace: true });
              }}
              className="mt-4 w-full py-2 text-center text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
            >
              Skip setup for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
