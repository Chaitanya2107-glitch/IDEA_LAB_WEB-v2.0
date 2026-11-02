/* =========================
   AUTH & ROLE TYPES (BACKEND + SHARED)
   ========================= */

export type Role =
  | "USER"
  | "ADMIN"
  | "LAB"
  | "AMBASSADOR"
  | "EVENT_MANAGER"
  | "TECH_SUPPORT";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant_id: string;
}

/* =========================
   FRONTEND USER TYPES
   ========================= */

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: Role;
  tenant_id?: string;

  // optional frontend-only helpers
  type?: "university" | "non-university" | "staff";
  isProfileComplete?: boolean;
  phone?: string;
  srn?: string;
  degree?: string;
  program?: string;
}

/* =========================
   STAFF TYPES (FRONTEND)
   ========================= */

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: Role; // 🔥 unified with backend roles
  avatar: string;
  tenant_id: string;
  is_verified: boolean;
  is_admin: boolean;
}

/* =========================
   EVENTS & CONTENT
   ========================= */

export interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_attendees: number;
  banner_image: string;
  date: Date;
  category: string;
  imageUrl: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  category: string;
  image: string;
  video?: string;
  description: string;
  longDescription?: string;
  author: string;
  technologies: string[];
  gallery?: string[];
  date: string;
  link?: string;
}

export interface GalleryItem {
  id: string;
  type: "image" | "video";
  src: string;
  poster?: string;
  title: string;
  size?: "small" | "medium" | "large";
}

/* =========================
   INVENTORY & INDENT
   ========================= */

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  type: 'component' | 'consumable' | 'tool';
  totalQuantity: number;
  availableQuantity: number;
  costPerUnit: number;
  unit?: string;
  location: string;
  room_no?: string;
  status: 'operational' | 'maintenance' | 'out_of_stock';
  is_rentable: boolean;
  image_url?: string;
  specification?: string;
  brand?: string;
  asset_id?: string;
  billNumber?: string;
  purchaseOrder?: string;
  purchaseDate?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IndentItem {
  id: string;
  name: string;
  category: string;
  type: "consumable" | "non-consumable";
  quantity: number;
  costPerUnit: number;
}

export interface Indent {
  id: string;
  studentName?: string;
  studentId?: string;
  user_name?: string;
  user_id?: string;
  tenant_id?: string;
  projectTitle: string;
  supervisor: string;
  purpose: string;
  items?: IndentItem[];
  items_json?: any;
  requestDate: string;
  status: "pending" | "active" | "returned" | "rejected" | "approved";
  paymentStatus: "pending" | "paid" | "na";
  totalCost: number;
  rejectionReason?: string;
}

/* =========================
   3D PRINT & PCB ORDERS
   ========================= */

export interface PrintOrder {
  id: string;
  fileName: string;
  gcodeFile?: string;
  thumbnail?: string;
  material: string;
  color: string;
  infill: number;
  cost: number;
  status: "queued" | "printing" | "completed" | "rejected" | "failed";
  progress: number;
  submitDate: string;
  paymentStatus: "pending" | "paid";
  paymentMethod: "online" | "cash";
  rejectionReason?: string;
}

export interface PcbOrder {
  id: string;
  fileName: string;
  user_id?: string;
  user_name?: string;
  tenant_id?: string;
  storagePath?: string;
  status: "pending_payment" | "queued" | "processing" | "completed" | "rejected" | "cancelled";
  specs: {
    material: string;
    layers: number;
    dimensions: string;
    quantity: number;
    thickness: string;
    copperWeight: string;
    solderMaskColor: string;
    silkscreenColor: string;
    surfaceFinish: string;
  };
  cost: number;
  submitDate: string;
  paymentStatus: "pending" | "paid";
  paymentMethod?: string | null;
  paidAt?: string | null;
  hasDesignFile?: boolean;
  rejectionReason?: string;
}

/* =========================
   BOOKINGS & REQUESTS
   ========================= */

export interface SlotBooking {
  id: string;
  userId?: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  attendees: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestDate: string;
  rejectionReason?: string;
}

export interface StaffRequest {
  id: string;
  type: "component_rent" | "3d_print" | "slot_booking" | "pcb_order";
  requesterName: string;
  requesterType: "university" | "guest";
  details: string;
  date: string;
  status: "pending";
  originalData?: any;
}

/* =========================
   LOGS & NOTIFICATIONS
   ========================= */

export interface HistoryLog {
  id: string;
  action: string;
  actorName: string;
  targetName: string;
  details: string;
  timestamp: string;
  type: "approval" | "rejection" | "system";
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
}

/* =========================
   GENERIC API RESPONSE
   ========================= */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
export interface CreateSlotPayload {
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  attendees: number;
}