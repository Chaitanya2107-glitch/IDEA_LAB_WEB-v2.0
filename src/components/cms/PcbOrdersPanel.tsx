import React, { useCallback, useEffect, useState } from "react";
import { CircuitBoard, Download, Loader2, RefreshCw } from "lucide-react";
import { authService } from "../../services/api";
import { PcbOrder } from "../../../types";

// Lab staff: the PCB fabrication queue. Paid online orders arrive as "queued"; "Pay at Lab"
// orders are queued too and staff record the payment here when the student pays.

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting online payment",
  queued: "Queued",
  processing: "In fabrication",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled (unpaid)",
};
const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-amber-50 text-amber-700",
  queued: "bg-blue-50 text-blue-700",
  processing: "bg-brand-50 text-brand-700",
  completed: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};
const FILTERS = ["active", "queued", "processing", "completed", "all"] as const;

const PcbOrdersPanel: React.FC = () => {
  const [orders, setOrders] = useState<PcbOrder[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("active");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await authService.getPcbOrders());
    } catch (err: any) {
      setError(err.message || "Could not load PCB orders.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err: any) {
      setError(err.message || "Action failed.");
    } finally {
      setBusy(null);
    }
  };
  const download = (order: PcbOrder) =>
    act(order.id, async () => {
      const url = await authService.getPcbDownloadUrl(order.id);
      window.open(url, "_blank", "noopener");
    });
  const reject = (order: PcbOrder) => {
    const reason = prompt("Reason for rejecting this PCB order (shown to the student):");
    if (reason) act(order.id, () => authService.updatePcbOrder(order.id, { status: "rejected", rejectionReason: reason }));
  };

  const shown = orders.filter((o) =>
    filter === "all" ? true : filter === "active" ? ["queued", "processing"].includes(o.status) : o.status === filter,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">PCB Orders</h1>
          <p className="text-sm text-slate-500">Fabrication queue. Download the design files, update the status, and record payments made at the lab.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === f ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-slate-500">
          <CircuitBoard className="mb-3 h-10 w-10 text-slate-300" />
          No PCB orders here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Specs</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className="border-t border-slate-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-slate-500">PCB-{o.id.slice(0, 8).toUpperCase()}</div>
                    <div className="max-w-[180px] truncate font-medium text-slate-900">{o.fileName}</div>
                    <div className="text-xs text-slate-400">{o.submitDate ? new Date(o.submitDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}</div>
                  </td>
                  <td className="px-4 py-3">{o.user_name || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {o.specs?.dimensions} · {o.specs?.layers} layers · ×{o.specs?.quantity}
                    <br />
                    {o.specs?.material} · {o.specs?.surfaceFinish}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">₹{o.cost}</div>
                    <div className={`text-xs font-medium ${o.paymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                      {o.paymentStatus === "paid" ? (o.paymentMethod?.startsWith("Online") ? "Paid online" : "Paid at lab") : "Unpaid"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    {o.rejectionReason && <div className="mt-1 text-xs text-red-600">{o.rejectionReason}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {o.hasDesignFile && (
                        <button disabled={busy === o.id} onClick={() => download(o)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          <Download className="h-3.5 w-3.5" /> Files
                        </button>
                      )}
                      {o.paymentStatus !== "paid" && ["queued", "processing", "completed"].includes(o.status) && (
                        <button disabled={busy === o.id} onClick={() => confirm(`Record ₹${o.cost} paid at the lab?`) && act(o.id, () => authService.updatePcbOrder(o.id, { paymentStatus: "paid" }))} className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                          Mark paid
                        </button>
                      )}
                      {o.status === "queued" && (
                        <button disabled={busy === o.id} onClick={() => act(o.id, () => authService.updatePcbOrder(o.id, { status: "processing" }))} className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                          Start fabrication
                        </button>
                      )}
                      {o.status === "processing" && (
                        <button disabled={busy === o.id} onClick={() => act(o.id, () => authService.updatePcbOrder(o.id, { status: "completed" }))} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                          Mark completed
                        </button>
                      )}
                      {["queued", "processing"].includes(o.status) && (
                        <button disabled={busy === o.id} onClick={() => reject(o)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PcbOrdersPanel;
