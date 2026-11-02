import {
  User,
  StaffUser,
  SlotBooking,
  StaffRequest,
  Notification,
  PcbOrder,
  PrintOrder,
  Indent,
  InventoryItem,
  HistoryLog,
  Event,
  Project,
} from "../../types";

const TOKEN_KEY = "token";

/* -------------------- Helpers -------------------- */
const json = async (res: Response) => {
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch { /* plain-text error */ }
    throw new Error(message || "API error");
  }
  return res.json();
};

const send = (method: string, url: string, data?: unknown) =>
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: data === undefined ? undefined : JSON.stringify(data),
  }).then(json);

const authHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface SignInFilters {
  kind?: "student" | "staff";
  outcome?: "success" | "failure";
  method?: "microsoft" | "google" | "password" | "email";
  email?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  limit?: number;
}

export interface SignInEvent {
  id: string;
  at: string;
  account_kind: "student" | "staff";
  method: "microsoft" | "google" | "password" | "email";
  outcome: "success" | "failure";
  reason: string | null;
  account_id: string | null;
  email: string | null;
  name: string | null;
  role: string | null;
  ip: string | null;
  user_agent: string | null;
  microsoft: { oid: string; tid: string; id_token_issued_at: string | null; id_token_sha256: string } | null;
  google?: { sub: string; email_verified: boolean; hosted_domain: string | null } | null;
}

export interface SignInSummary {
  time_zone: string;
  totals: {
    sign_ins: number;
    failed_attempts: number;
    unique_students: number;
    unique_staff: number;
    registered_students: number;
    registered_staff: number;
    sign_ins_by_method?: { microsoft: number; google: number; password: number; email?: number };
  };
  today: { sign_ins: number; unique_people: number };
  days: number;
  daily: Array<{ date: string; sign_ins: number; failures: number; unique_students: number; unique_staff: number }>;
}

const signInQuery = (filters: SignInFilters) =>
  new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();

/* ==================================================
   AUTH SERVICE
   ================================================== */
export const authService = {
  /* ================= MICROSOFT SIGN-IN (students and staff) ================= */

  // Full-page redirect to Microsoft; the server brings the browser back to /auth/complete.
  microsoftSignInUrl(portal: "student" | "staff", next?: string): string {
    const q = new URLSearchParams({ portal });
    if (next) q.set("next", next);
    return `/api/auth/microsoft/start?${q}`;
  },

  // Google sign-in for visitors outside REVA (general access); same completion step.
  googleSignInUrl(next?: string): string {
    return next ? `/api/auth/google/start?${new URLSearchParams({ next })}` : "/api/auth/google/start";
  },

  async completeMicrosoftSignIn(code: string): Promise<{ user?: User; staff?: StaffUser; next: string | null }> {
    const data = await send("POST", "/api/auth/microsoft/complete", { code });
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  /* ================= EMAIL + PASSWORD (student portal) ================= */

  // Sends a confirmation link; the account is created when it is opened.
  async register(name: string, email: string, password: string): Promise<{ message: string }> {
    return send("POST", "/api/auth/register", { name, email, password });
  },

  async verifyEmail(token: string, password: string): Promise<User> {
    const data = await send("POST", "/api/auth/verify-email", { token, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    return data.user;
  },

  async passwordLogin(email: string, password: string): Promise<User> {
    const data = await send("POST", "/api/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    return data.user;
  },

  /* ================= EMERGENCY ADMINISTRATOR (password) ================= */

  async staffLogin(email: string, password: string): Promise<StaffUser> {
    const data = await send("POST", "/api/auth/staff-login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    return data.staff;
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return send("POST", "/api/auth/forgot-password", { email });
  },

  async resetPassword(token: string, password: string): Promise<{ message: string; account: "user" | "staff" }> {
    return send("POST", "/api/auth/reset-password", { token, password });
  },

  // Signs out other devices; this one receives a fresh session.
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const data = await send("POST", "/api/auth/change-password", { currentPassword, newPassword });
    localStorage.setItem(TOKEN_KEY, data.token);
  },

  async logoutEverywhere(): Promise<void> {
    await send("POST", "/api/auth/logout-all");
    localStorage.removeItem(TOKEN_KEY);
  },

  /* ================= SESSION ================= */

  async getCurrentSession(): Promise<{
    user: User | null;
    staff: StaffUser | null;
  }> {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return { user: null, staff: null };

      const res = await fetch(`/api/user/me`, {
        headers: authHeaders(),
      });

      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        return { user: null, staff: null };
      }

      const data = await json(res);

      if (data.staff) {
        return { user: null, staff: data.staff };
      }

      return { user: data.user, staff: null };
    } catch {
      return { user: null, staff: null };
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
  },

  /* ================= PROFILES ================= */

  async updateProfile(payload: User): Promise<User> {
    const res = await fetch(`/api/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await json(res);
    return data.user ?? data;
  },

  async updateStaffProfile(payload: StaffUser): Promise<StaffUser> {
    const res = await fetch(`/api/staff/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await json(res);
    return data.user ?? data;
  },

  /* ================= INVENTORY ================= */

  async getInventory(): Promise<InventoryItem[]> {
    const res = await fetch(`/api/inventory`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  /* ================= GALLERY ================= */

  async getGalleryItems(): Promise<any[]> {
    const res = await fetch(`/api/gallery`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  async addGalleryItem(data: any): Promise<any> {
    const res = await fetch(`/api/gallery`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async updateGalleryItem(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/gallery/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async deleteGalleryItem(id: string): Promise<void> {
    const res = await fetch(`/api/gallery/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete gallery item");
  },

  /* ================= STAFF REQUESTS ================= */

  async getStaffRequests(): Promise<StaffRequest[]> {
    const res = await fetch(`/api/staff/requests`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  /* ================= SLOT BOOKINGS ================= */

  async getSlotRequests(): Promise<SlotBooking[]> {
    const res = await fetch(`/api/slots`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  /* ================= USER HISTORY ================= */

  async getUserHistory() {
    const res = await fetch(`/api/user/history`, {
      headers: authHeaders(),
    });
    const data = await json(res);
    return data.history;
  },

  /* ================= SIGN-IN LOG (admin, tech support) ================= */

  async getSignInSummary(days = 30): Promise<SignInSummary> {
    return send("GET", `/api/admin/sign-ins/summary?days=${days}`);
  },

  async getSignIns(filters: SignInFilters = {}): Promise<{ total: number; page: number; limit: number; events: SignInEvent[] }> {
    return send("GET", `/api/admin/sign-ins?${signInQuery(filters)}`);
  },

  // Downloads the (filtered) log as a CSV file.
  async downloadSignInsCsv(filters: SignInFilters = {}): Promise<void> {
    const res = await fetch(`/api/admin/sign-ins/export?${signInQuery(filters)}`, { headers: authHeaders() });
    if (!res.ok) await json(res);
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "sign-ins.csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /* ================= USERS & STAFF MANAGEMENT ================= */

  async getUsers(): Promise<User[]> {
    const res = await fetch(`/api/users`, { headers: authHeaders() });
    return json(res);
  },

  async getStaff(): Promise<StaffUser[]> {
    const res = await fetch(`/api/staff`, { headers: authHeaders() });
    return json(res);
  },

  async updateUserRole(id: string, role: string): Promise<User> {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ role }),
    });
    return json(res);
  },

  async updateStaffRole(id: string, role: string): Promise<StaffUser> {
    const res = await fetch(`/api/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ role }),
    });
    return json(res);
  },

  async updateStaffVerification(id: string, is_verified: boolean): Promise<StaffUser> {
    const res = await fetch(`/api/staff/${id}/verify`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ is_verified }),
    });
    return json(res);
  },

  async deleteUser(id: string): Promise<void> {
    await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  },

  async deleteStaff(id: string): Promise<void> {
    await fetch(`/api/staff/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  },

  async logActivity(action: string, actor: StaffUser, details?: string, target?: { type: string, id: string, name: string }): Promise<void> {
    await fetch(`/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        actor_id: actor.id,
        actor_name: actor.name,
        action,
        details,
        target_type: target?.type,
        target_id: target?.id,
        target_name: target?.name,
        timestamp: new Date().toISOString()
      }),
    });
  },

  /* ================= PCB ================= */

  async getPcbOrders(): Promise<PcbOrder[]> {
    const res = await fetch(`/api/pcb-orders`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  // Razorpay order for a PCB order that was placed with paymentMethod "online".
  async createPcbPaymentOrder(pcbOrderId: string): Promise<{ keyId: string; orderId: string; amount: number; currency: string }> {
    return send("POST", `/api/payments/pcb-orders/${encodeURIComponent(pcbOrderId)}/order`);
  },

  // Lab staff: change status, or record a payment made at the lab.
  async updatePcbOrder(id: string, data: { status?: string; paymentStatus?: "pending" | "paid"; rejectionReason?: string }): Promise<PcbOrder> {
    return send("PUT", `/api/pcb-orders/${encodeURIComponent(id)}`, data);
  },

  // Lab staff: short-lived link to the student's design files.
  async getPcbDownloadUrl(id: string): Promise<string> {
    const data = await send("GET", `/api/pcb-orders/${encodeURIComponent(id)}/download`);
    return data.url;
  },

  /* ================= INDENTS ================= */

  async getIndents(): Promise<Indent[]> {
    const res = await fetch(`/api/indents`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  /* ================= PROJECTS ================= */

  async getProjects(): Promise<Project[]> {
    const res = await fetch(`/api/projects`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  async addProject(data: any): Promise<Project> {
    const res = await fetch(`/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async updateProject(id: string, data: any): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete project");
  },

  /* ================= STAFF HISTORY ================= */

  async getHistory(): Promise<HistoryLog[]> {
    const res = await fetch(`/api/history`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  /* ================= USER PRINT ORDERS ================= */

  async getPrintOrders(): Promise<PrintOrder[]> {
    const res = await fetch(`/api/print-orders`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  /* ================= 3D PRINT ORDERS ================= */

  // Server prices the order from the uploaded STL; the returned cost is what gets charged.
  async createPrintOrder(data: {
    storagePath: string;
    fileName: string;
    materialId: string;
    color?: string;
    infill: number;
    scale: number;
    quality: string;
  }): Promise<any> {
    return send("POST", "/api/print-orders", data);
  },

  async updatePrintOrderStatus(id: string, status: string): Promise<any> {
    return send("PUT", `/api/print-orders/${id}/status`, { status });
  },

  async getPrintOrderApprover(id: string): Promise<string | null> {
    const data = await send("GET", `/api/print-orders/${id}/approver`);
    return data.name ?? null;
  },

  async downloadPrintOrderStl(orderId: string): Promise<string> {
    const data = await send("GET", `/api/print-orders/${orderId}/download`);
    return data.url; // signed URL, valid for 5 minutes
  },

  /* ================= PAYMENTS (Razorpay) ================= */

  async createPaymentOrder(printOrderId: string): Promise<{ keyId: string; orderId: string; amount: number; currency: string }> {
    return send("POST", `/api/payments/print-orders/${printOrderId}/order`);
  },

  async verifyPayment(payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): Promise<any> {
    return send("POST", "/api/payments/verify", payment);
  },

  /* ================= FILE UPLOADS ================= */

  // Two steps: the API issues a one-time upload URL, then the raw file is sent to it.
  async uploadFile(bucket: "projects" | "stl-files" | "pcb-files", file: File, folder?: string): Promise<{ path: string; publicUrl: string | null }> {
    const target = await send("POST", "/api/uploads", {
      bucket,
      folder,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    });
    const res = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": target.contentType || "application/octet-stream", ...authHeaders() },
      body: file,
    });
    const stored = await json(res);
    return { path: stored.path, publicUrl: stored.publicUrl };
  },

  /* ================= CALENDAR & CLOSURES ================= */

  // Students cancel their own upcoming booking (frees the time slot).
  async cancelSlotBooking(id: string): Promise<SlotBooking> {
    return send("POST", `/api/slots/${encodeURIComponent(id)}/cancel`);
  },

  async getSlotCalendar(): Promise<{ date: string; status: string; purpose: string; start_time: string | null; end_time: string | null }[]> {
    return send("GET", "/api/slots/calendar");
  },

  async getLabClosures(): Promise<any[]> {
    return send("GET", "/api/lab-closures");
  },

  async saveLabClosure(data: { date: string; reason: string; closure_type: string }): Promise<any> {
    return send("POST", "/api/lab-closures", data);
  },

  async deleteLabClosure(id: string): Promise<void> {
    await send("DELETE", `/api/lab-closures/${id}`);
  },

  /* ================= EVENT REGISTRATION STATUS ================= */

  async isRegisteredForEvent(eventId: string): Promise<boolean> {
    const data = await send("GET", `/api/events/${eventId}/registration`);
    return !!data.registered;
  },

  async getEventRegistrationCounts(): Promise<Record<string, number>> {
    return send("GET", "/api/events/registration-counts");
  },

  /* ================= NOTIFICATIONS ================= */

  async getNotifications(): Promise<Notification[]> {
    const res = await fetch(`/api/notifications`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  /* ================= CMS PAGES ================= */

  async getCMSPage(name: string): Promise<any> {
    const res = await fetch(`/api/cms-pages?name=${name}`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  async updateCMSPage(page_name: string, content: any, updated_by: string): Promise<any> {
    const res = await fetch(`/api/cms-pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ page_name, content, updated_by }),
    });
    return json(res);
  },

  /* ================= PDF REVIEWS ================= */

  async getPDFReviews(staffId?: string, isAdmin?: boolean): Promise<any[]> {
    const res = await fetch(`/api/pdf-reviews?staffId=${staffId || ''}&isAdmin=${isAdmin || false}`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  async submitPDFReview(data: any): Promise<any> {
    const res = await fetch(`/api/pdf-reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async updatePDFReviewStatus(id: string, status: string, notes?: string): Promise<any> {
    const res = await fetch(`/api/pdf-reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status, admin_notes: notes, reviewed_at: new Date().toISOString() }),
    });
    return json(res);
  },

  async createIndent(data: Partial<Indent>): Promise<Indent> {
    const res = await fetch(`/api/indents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async getEventById(id: string): Promise<Event> {
    const res = await fetch(`/api/events/${id}`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  async getBlockedDates(): Promise<Date[]> {
    const res = await fetch(`/api/slots/blocked`, {
      headers: authHeaders(),
    });
    const dates: string[] = await json(res);
    return dates.map((d) => new Date(d));
  },

  async createSlotRequest(data: any): Promise<SlotBooking> {
    const res = await fetch(`/api/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async createPcbOrder(data: Partial<PcbOrder> & { paymentMethod?: "online" | "lab" }): Promise<PcbOrder> {
    const res = await fetch(`/api/pcb-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async getProjectById(id: string): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, {
       headers: authHeaders(),
    });
    return json(res);
  },

  /* ================= NEW INVENTORY & STATS ================= */

  async updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const res = await fetch(`/api/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async deleteInventoryItem(id: string): Promise<void> {
    const res = await fetch(`/api/inventory/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete item");
  },

  async addInventoryItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
    const res = await fetch(`/api/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async bulkDeleteInventoryItems(ids: string[]): Promise<void> {
    const res = await fetch(`/api/inventory/batch-delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error("Failed to delete items");
  },

  async getMachineUsage(): Promise<any[]> {
    const res = await fetch(`/api/stats/machine-usage`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  async getEvents(): Promise<Event[]> {
    const res = await fetch(`/api/events`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  async addEvent(data: Partial<Event>): Promise<Event> {
    const res = await fetch(`/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    const res = await fetch(`/api/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async deleteEvent(id: string): Promise<void> {
    const res = await fetch(`/api/events/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete event");
  },

  async updateSlotStatus(id: string, status: string, rejectionReason?: string): Promise<SlotBooking> {
    const res = await fetch(`/api/slots?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status, rejectionReason }),
    });
    return json(res);
  },

  /* ================= PRINT MATERIALS CONFIG ================= */

  async getPrintMaterialsConfig(): Promise<any[]> {
    const res = await fetch(`/api/print-materials`, {
      headers: authHeaders(),
    });
    return json(res);
  },

  async updatePrintMaterialConfig(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/print-materials/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async addPrintMaterialConfig(data: any): Promise<any> {
    const res = await fetch(`/api/print-materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async deletePrintMaterialConfig(id: string): Promise<void> {
    const res = await fetch(`/api/print-materials/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete material");
  },

  /* ================= EVENT REGISTRATIONS ================= */

  async registerForEvent(data: any): Promise<any> {
    const res = await fetch(`/api/events/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return json(res);
  },

  async getEventRegistrations(eventId: string): Promise<any[]> {
    const res = await fetch(`/api/events/${eventId}/registrations`, {
      headers: authHeaders(),
    });
    return json(res);
  }
};
