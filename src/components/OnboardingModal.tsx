import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "../../types";
import { authService } from "../services/api";
import {
  BookOpen, Calendar, ChevronRight,
  CheckCircle, Loader2, Sparkles, ArrowLeft
} from "lucide-react";

interface OnboardingModalProps {
  user: User;
  onComplete: (updatedUser: User) => void;
}

/* ─── Data ─── */
const DEGREES = [
  { label: "B.Tech",   value: "B.Tech",   icon: "🎓" },
  { label: "M.Tech",   value: "M.Tech",   icon: "📚" },
  { label: "MBA",      value: "MBA",      icon: "💼" },
  { label: "PhD",      value: "PhD",      icon: "🔬" },
  { label: "B.Sc",     value: "B.Sc",     icon: "⚗️" },
  { label: "M.Sc",     value: "M.Sc",     icon: "🧪" },
  { label: "Faculty",  value: "Faculty",  icon: "🏫" },
  { label: "Other",    value: "Other",    icon: "📋" },
];

const PROGRAMS: Record<string, string[]> = {
  "B.Tech": ["Computer Science", "Electronics", "Mechanical", "Civil", "Electrical", "IT", "AI & ML", "Data Science"],
  "M.Tech": ["Computer Science", "VLSI", "Structural", "Power Systems", "Robotics", "AI & ML"],
  "MBA":    ["Finance", "Marketing", "Operations", "HR", "Business Analytics"],
  "PhD":    ["Computer Science", "Electronics", "Mechanical", "Management", "Sciences"],
  "B.Sc":   ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science"],
  "M.Sc":   ["Physics", "Chemistry", "Mathematics", "Computer Science"],
  "Faculty":["Computer Science", "Electronics", "Mathematics", "Physics", "Management"],
  "Other":  ["Other"],
};

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

/* ─── Step indicator ─── */
const StepDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-300 ${
          i < current ? "bg-brand-600 w-6" : i === current ? "bg-brand-500 w-8" : "bg-slate-200 w-4"
        }`}
      />
    ))}
  </div>
);

/* ═══════════════ MAIN COMPONENT ═══════════════ */
const OnboardingModal: React.FC<OnboardingModalProps> = ({ user, onComplete }) => {
  const [step, setStep]       = useState(0);
  const [degree, setDegree]   = useState("");
  const [program, setProgram] = useState("");
  const [semester, setSemester] = useState<number | null>(null);
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const programs = degree ? PROGRAMS[degree] ?? [] : [];
  const showSemester = !["Faculty", "PhD", "Other"].includes(degree);

  const totalSteps = showSemester ? 3 : 2;

  const canNext = () => {
    if (step === 0) return !!degree;
    if (step === 1) return !!program;
    if (step === 2) return !!semester;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Saved to users + profiles by the API
      await authService.updateProfile({
        ...user,
        degree,
        program,
        semester: showSemester ? semester : null,
        isProfileComplete: true,
      } as any);
    } catch {/* non-fatal, proceed even if the API is unavailable */}


    // Mark done locally
    setDone(true);
    setTimeout(() => {
      const updated: User = {
        ...user,
        degree,
        program,
        isProfileComplete: true,
      };
      onComplete(updated);
    }, 1000);
    setSaving(false);
  };

  const next = () => {
    if (step === 0) { setProgram(""); }
    if (!showSemester && step === 1) { handleSave(); return; }
    if (step === totalSteps - 1) { handleSave(); return; }
    setStep(s => s + 1);
  };

  const back = () => setStep(s => Math.max(0, s - 1));

  /* ── Slide animation ── */
  const variants = {
    enter: { opacity: 0, x: 30 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-5">
          {done ? (
            <div className="py-2 text-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-600" aria-hidden="true" />
              </motion.div>
              <p className="font-display text-xl font-semibold text-slate-900">You're all set, {firstName}!</p>
              <p className="mt-1 text-sm text-slate-600">Taking you to your dashboard…</p>
            </div>
          ) : (
            <>
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Setup</span>
              </div>
              <h2 className="font-display text-xl font-semibold text-slate-900">
                {step === 0 && `Welcome, ${firstName}! 👋`}
                {step === 1 && "Your Program"}
                {step === 2 && "Your Semester"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {step === 0 && "Let's get your profile ready — it takes 30 seconds."}
                {step === 1 && `What are you studying in ${degree}?`}
                {step === 2 && "Which semester are you in right now?"}
              </p>
            </>
          )}
        </div>

        {/* Body */}
        {!done && (
          <div className="px-6 py-5">
            <StepDots current={step} total={totalSteps} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {/* Step 0 — Degree */}
                {step === 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {DEGREES.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDegree(d.value)}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                          degree === d.value
                            ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-xl" aria-hidden="true">{d.icon}</span>
                        <span>{d.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 1 — Program */}
                {step === 1 && (
                  <div className="grid grid-cols-1 gap-2.5 max-h-64 overflow-y-auto pr-1">
                    {programs.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProgram(p)}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                          program === p
                            ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {p}
                        </span>
                        {program === p && <CheckCircle className="h-4 w-4 text-brand-600" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 2 — Semester */}
                {step === 2 && (
                  <div className="grid grid-cols-4 gap-3">
                    {SEMESTERS.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSemester(s)}
                        className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                          semester === s
                            ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <Calendar className="mb-0.5 h-4 w-4 opacity-60" aria-hidden="true" />
                        <span>Sem {s}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="mt-6 flex items-center gap-3">
              {step > 0 && (
                <button
                  onClick={back}
                  aria-label="Back"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                onClick={next}
                disabled={!canNext() || saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === totalSteps - 1 ? (
                  <>
                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                    Finish Setup
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>

            {/* Skip link */}
            <p className="mt-4 text-center">
              <button
                onClick={() => onComplete({ ...user, isProfileComplete: true })}
                className="py-2 text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
              >
                Skip for now
              </button>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OnboardingModal;
