import React, { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { authService, SignInEvent, SignInFilters, SignInSummary } from "../../services/api";

// Who used the portal: counts, a per-day table and the full sign-in log (from the
// separate, append-only audit database), with CSV export as proof.

const PAGE_SIZE = 50;

const REASONS: Record<string, string> = {
  domain_not_allowed: "Not a @reva.edu.in account",
  wrong_tenant: "Not from REVA's Microsoft directory",
  not_staff: "Not on the staff list",
  staff_not_verified: "Staff access turned off",
  account_mismatch: "Different Microsoft account for this email",
  cancelled: "Cancelled at Microsoft",
  bad_credentials: "Wrong email or password",
  locked: "Locked after too many attempts",
  invalid_id_token: "Sign-in token rejected",
  token_exchange_failed: "Microsoft/Google did not confirm the sign-in",
  reva_use_microsoft: "REVA account tried Google (must use Microsoft)",
  email_not_verified: "Google email not verified",
  invalid_email: "Invalid email",
  bad_password: "Wrong password",
  no_password_account: "No password account for this email",
  verify_wrong_password: "Wrong password on the sign-up link",
};

const METHOD_LABEL: Record<string, string> = {
  microsoft: "Microsoft",
  google: "Google",
  email: "Email + password",
  password: "Emergency password",
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

const Stat: React.FC<{ label: string; value: number | string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

const SignInLogPanel: React.FC = () => {
  const [summary, setSummary] = useState<SignInSummary | null>(null);
  const [events, setEvents] = useState<SignInEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<SignInFilters>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, list] = await Promise.all([
        authService.getSignInSummary(30),
        authService.getSignIns({ ...filters, page, limit: PAGE_SIZE }),
      ]);
      setSummary(s);
      setEvents(list.events);
      setTotal(list.total);
    } catch (err: any) {
      setError(err.message || "Could not load the sign-in log.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key: keyof SignInFilters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await authService.downloadSignInsCsv(filters);
    } catch (err: any) {
      setError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const select = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sign-in Log</h1>
          <p className="text-sm text-slate-500">Every sign-in to the portal, kept in separate records that cannot be edited (Microsoft and emergency password, Google, and email + password are stored in different databases).</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={exportCsv} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download CSV
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Students who signed in" value={summary.totals.unique_students} hint={`${summary.totals.registered_students} student accounts`} />
          <Stat label="Staff who signed in" value={summary.totals.unique_staff} hint={`${summary.totals.registered_staff} staff accounts`} />
          <Stat label="Total sign-ins" value={summary.totals.sign_ins} hint={`${summary.totals.failed_attempts} refused attempts`} />
          <Stat label="Today" value={summary.today.sign_ins} hint={`${summary.today.unique_people} different people`} />
          {summary.totals.sign_ins_by_method && (
            <Stat
              label="Sign-ins by method"
              value={`${summary.totals.sign_ins_by_method.microsoft} · ${summary.totals.sign_ins_by_method.google} · ${summary.totals.sign_ins_by_method.email ?? 0} · ${summary.totals.sign_ins_by_method.password}`}
              hint="Microsoft · Google · Email · Emergency password"
            />
          )}
        </div>
      )}

      {summary && summary.daily.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <caption className="px-4 pt-4 text-left font-semibold text-slate-800">Last {summary.days} days (India time)</caption>
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Sign-ins</th><th className="px-4 py-2">Students</th><th className="px-4 py-2">Staff</th><th className="px-4 py-2">Refused</th></tr>
            </thead>
            <tbody>
              {summary.daily.map((d) => (
                <tr key={d.date} className="border-t border-slate-50">
                  <td className="px-4 py-2 font-medium">{d.date}</td>
                  <td className="px-4 py-2">{d.sign_ins}</td>
                  <td className="px-4 py-2">{d.unique_students}</td>
                  <td className="px-4 py-2">{d.unique_staff}</td>
                  <td className="px-4 py-2">{d.failures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <input type="search" placeholder="Email starts with…" aria-label="Filter by email" className={`${select} min-w-[200px] flex-1`}
            onChange={(e) => setFilter("email", e.target.value.trim())} />
          <select aria-label="Account type" className={select} onChange={(e) => setFilter("kind", e.target.value)}>
            <option value="">Students and staff</option><option value="student">Students</option><option value="staff">Staff</option>
          </select>
          <select aria-label="Sign-in method" className={select} onChange={(e) => setFilter("method", e.target.value)}>
            <option value="">All methods</option><option value="microsoft">Microsoft</option><option value="google">Google</option><option value="email">Email + password</option><option value="password">Emergency password</option>
          </select>
          <select aria-label="Result" className={select} onChange={(e) => setFilter("outcome", e.target.value)}>
            <option value="">All results</option><option value="success">Signed in</option><option value="failure">Refused</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-slate-500">From <input type="date" className={select} onChange={(e) => setFilter("from", e.target.value)} /></label>
          <label className="flex items-center gap-1 text-xs text-slate-500">To <input type="date" className={select} onChange={(e) => setFilter("to", e.target.value)} /></label>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
        ) : events.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No sign-ins match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Person</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">How</th><th className="px-3 py-2">IP address</th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-slate-50 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtTime(e.at)}</td>
                    <td className="px-3 py-2"><div className="font-medium text-slate-900">{e.name || "—"}</div><div className="text-xs text-slate-500">{e.email || "—"}</div></td>
                    <td className="px-3 py-2">{e.account_kind === "staff" ? `Staff${e.role ? ` (${e.role})` : ""}` : "Student"}</td>
                    <td className="px-3 py-2">
                      {e.outcome === "success"
                        ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{e.reason === "sign_up" ? "Signed up" : "Signed in"}</span>
                        : <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700" title={e.reason ?? ""}>{REASONS[e.reason ?? ""] ?? "Refused"}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{METHOD_LABEL[e.method] ?? e.method}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total} record{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">Previous</button>
            <span>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInLogPanel;
