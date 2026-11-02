# FabLab Management Platform — Full Project Specification

> **Note:** this is the original concept specification. The site that is actually built and
> deployed is React + Express + MongoDB on AWS; see [README.md](./README.md) and
> [DEPLOYMENT.md](./DEPLOYMENT.md).

> **Stack:** Flutter (frontend) · Firebase (backend) · Stitch (middleware/orchestration) · Antigravity (AI agent layer)
> **Target:** University/Institution Fabrication Lab — 3D Printing, PCB Manufacturing, Event Booking, Session Booking
> **Auth:** Google OAuth · Microsoft OAuth · Phone OTP (Students) | Admin-provisioned accounts (Staff)
> **Platforms:** Android · iOS · Web (desktop browser) · macOS · Windows — single Flutter codebase, fully responsive

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Firebase Schema (Full)](#2-firebase-schema-full)
3. [Authentication & Roles](#3-authentication--roles)
4. [Module 1 — 3D Printing](#4-module-1--3d-printing)
5. [Module 2 — PCB Printing](#5-module-2--pcb-printing)
6. [Module 3 — Event Booking](#6-module-3--event-booking)
7. [Module 4 — Lab Session Booking](#7-module-4--lab-session-booking)
8. [Student Dashboard](#8-student-dashboard)
9. [Staff Dashboards by Role](#9-staff-dashboards-by-role)
10. [Indent Form Generation](#10-indent-form-generation)
11. [Real-Time Progress Tracking](#11-real-time-progress-tracking)
12. [Notifications System](#12-notifications-system)
13. [Stitch Integration Points](#13-stitch-integration-points)
14. [Flutter App Structure](#14-flutter-app-structure)
15. [Security Rules](#15-firebase-security-rules)
16. [Environment Variables & Secrets](#16-environment-variables--secrets)
17. [Critical Business Logic](#17-critical-business-logic)
18. [File Storage Strategy](#18-file-storage-strategy)
19. [Antigravity Agent Instructions](#19-antigravity-agent-instructions)
20. [Responsive Design & Desktop/Mobile Layout](#20-responsive-design--desktopmobile-layout)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Flutter App (Client)                           │
│   Mobile (Android/iOS) │ Desktop (macOS/Windows) │ Web (Browser)    │
│   Student UI │ Staff UI (Role-gated) │ Admin Console                 │
│   Single codebase — adaptive layout per breakpoint                   │
└──────────────────────────┬──────────────────────────────────────────┘
                         │ Firebase SDK (Direct reads/writes)
          ┌──────────────┴──────────────┐
          │         Firebase             │
          │  Auth │ Firestore │ Storage  │
          │  Functions │ Realtime DB     │
          └──────────────┬──────────────┘
                         │
          ┌──────────────┴──────────────┐
          │    Stitch Middleware         │
          │  (Orchestration, Webhooks,   │
          │   Email, PDF gen triggers)   │
          └──────────────┬──────────────┘
                         │
          ┌──────────────┴──────────────┐
          │   Antigravity AI Layer       │
          │  (Smart routing, NLP search, │
          │   Automated lab suggestions) │
          └─────────────────────────────┘
```

### Data Flow Summary
- **Student** authenticates → lands on Student Dashboard
- **Staff** authenticates (admin-provisioned) → lands on Role Dashboard
- **3D/PCB jobs** flow: Submit → Firestore job doc → Realtime DB for live progress → FCM for push
- **Events** managed in Firestore → Calendar view → Booking sub-collection
- **Indent PDFs** generated server-side via Firebase Functions → stored in Storage → download URL returned
- **Stitch** handles: email notifications, webhook-to-printer bridge, PDF generation orchestration
- **Antigravity** reads Firestore collections for intelligent routing and student guidance

---

## 2. Firebase Schema (Full)

> All timestamps are Firestore `Timestamp` type. All IDs are auto-generated unless noted.

### 2.1 `users` Collection
```
users/{userId}
  ├── uid: string                      // Firebase Auth UID
  ├── displayName: string
  ├── email: string
  ├── photoURL: string | null
  ├── phoneNumber: string | null
  ├── role: "student" | "admin" | "3d_tech" | "pcb_tech" | "event_manager"
  ├── rollNumber: string | null        // Students only
  ├── department: string | null        // Students only
  ├── institution: string
  ├── authProvider: ["google" | "microsoft" | "phone"]  // array, can have multiple
  ├── isApproved: boolean              // Staff accounts start false
  ├── isActive: boolean
  ├── createdAt: Timestamp
  ├── lastLoginAt: Timestamp
  └── notificationTokens: string[]    // FCM tokens (multi-device)
```

### 2.2 `print_jobs_3d` Collection
```
print_jobs_3d/{jobId}
  ├── jobId: string                    // same as doc ID
  ├── studentId: string               // ref → users/{userId}
  ├── studentName: string             // denormalized for lab tech view
  ├── studentEmail: string
  ├── rollNumber: string
  ├── department: string
  ├── projectName: string
  ├── description: string
  ├── modelFiles: [                   // array of uploaded models
  │     {
  │       fileName: string,
  │       storagePath: string,        // Firebase Storage path
  │       downloadURL: string,
  │       fileSizeBytes: number,
  │       format: "stl" | "obj" | "3mf" | "step",
  │       thumbnailURL: string | null
  │     }
  │   ]
  ├── printerType: "single_color" | "multi_color"
  ├── colorConfig: {                  // Bambu-style color mapping
  │     palette: [                    // array of color slots
  │       {
  │         slotIndex: number,        // 0-3 for multi, 0 for single
  │         hexColor: string,         // e.g. "#FF5733"
  │         materialType: "PLA" | "PETG" | "ABS" | "TPU",
  │         filamentBrand: string | null
  │       }
  │     ]
  │   }
  ├── printSettings: {
  │     layerHeight: number,          // mm e.g. 0.2
  │     infillPercent: number,        // 0-100
  │     supportEnabled: boolean,
  │     estimatedGrams: number | null,
  │     estimatedMinutes: number | null
  │   }
  ├── status: "submitted" | "queued" | "printing" | "post_processing" | "ready_for_pickup" | "completed" | "failed" | "cancelled"
  ├── priority: number                // 1 = highest, set by lab tech
  ├── assignedTechId: string | null   // ref → users/{userId}
  ├── assignedPrinterId: string | null // ref → printers/{printerId}
  ├── cost: {
  │     materialCost: number,
  │     laborCost: number,
  │     totalCost: number,
  │     currency: "INR",
  │     isPaid: boolean,
  │     paymentMethod: string | null
  │   }
  ├── indentFormURL: string | null    // Generated PDF download URL
  ├── indentGeneratedAt: Timestamp | null
  ├── notes: string                   // Student notes
  ├── labNotes: string               // Internal lab notes (hidden from student)
  ├── submittedAt: Timestamp
  ├── updatedAt: Timestamp
  ├── estimatedCompletionAt: Timestamp | null
  └── completedAt: Timestamp | null
```

### 2.3 `print_jobs_3d/{jobId}/progress_log` Sub-collection
```
progress_log/{logId}
  ├── stage: string                   // e.g. "Heating bed", "Layer 45/200"
  ├── percentComplete: number         // 0-100
  ├── message: string
  ├── updatedBy: string              // "system" | userId
  └── timestamp: Timestamp
```

### 2.4 `pcb_jobs` Collection
```
pcb_jobs/{jobId}
  ├── jobId: string
  ├── studentId: string
  ├── studentName: string
  ├── studentEmail: string
  ├── rollNumber: string
  ├── department: string
  ├── projectName: string
  ├── description: string
  ├── files: [
  │     {
  │       fileName: string,
  │       storagePath: string,
  │       downloadURL: string,
  │       fileType: "gerber" | "excellon" | "brd" | "kicad_pcb" | "pdf" | "zip",
  │       fileSizeBytes: number
  │     }
  │   ]
  ├── pcbSpecs: {
  │     layers: number,               // 1, 2, 4, 6, etc.
  │     boardSizeX_mm: number,
  │     boardSizeY_mm: number,
  │     quantity: number,
  │     copperThickness: "1oz" | "2oz",
  │     boardThickness: number,       // mm e.g. 1.6
  │     surfaceFinish: "HASL" | "ENIG" | "OSP",
  │     solderMaskColor: string,      // hex or named
  │     silkscreenColor: string,
  │     vias: "tented" | "untented",
  │     minTraceWidth_mm: number,
  │     minDrillSize_mm: number,
  │     hasBlindVias: boolean,
  │     hasBuriedVias: boolean,
  │     castellatedHoles: boolean,
  │     specialRequirements: string
  │   }
  ├── designReview: {
  │     drcPassed: boolean | null,    // Design Rule Check
  │     reviewedBy: string | null,
  │     reviewNotes: string,
  │     reviewedAt: Timestamp | null
  │   }
  ├── status: "submitted" | "design_review" | "approved" | "queued" | "etching" | "drilling" | "finishing" | "quality_check" | "ready_for_pickup" | "completed" | "failed" | "rejected"
  ├── assignedTechId: string | null
  ├── cost: {
  │     baseCost: number,
  │     perLayerCost: number,
  │     finishingCost: number,
  │     totalCost: number,
  │     currency: "INR",
  │     isPaid: boolean
  │   }
  ├── indentFormURL: string | null
  ├── notes: string
  ├── labNotes: string
  ├── submittedAt: Timestamp
  ├── updatedAt: Timestamp
  └── completedAt: Timestamp | null
```

### 2.5 `events` Collection
```
events/{eventId}
  ├── eventId: string
  ├── title: string
  ├── description: string
  ├── category: "workshop" | "hackathon" | "seminar" | "competition" | "open_day" | "other"
  ├── bannerImageURL: string
  ├── venue: string
  ├── venueMapURL: string | null
  ├── startDateTime: Timestamp
  ├── endDateTime: Timestamp
  ├── registrationDeadline: Timestamp
  ├── maxCapacity: number
  ├── currentRegistrations: number    // denormalized counter
  ├── waitlistEnabled: boolean
  ├── isOnline: boolean
  ├── meetLink: string | null
  ├── isFree: boolean
  ├── entryFee: number               // 0 if free
  ├── tags: string[]
  ├── createdBy: string             // ref → users/{userId}
  ├── managedBy: string             // ref → users/{userId} (event_manager)
  ├── status: "draft" | "published" | "cancelled" | "completed"
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

### 2.6 `events/{eventId}/bookings` Sub-collection
```
bookings/{bookingId}
  ├── bookingId: string
  ├── userId: string
  ├── userName: string
  ├── userEmail: string
  ├── rollNumber: string
  ├── department: string
  ├── ticketNumber: string           // Human-readable e.g. "EVT-2024-0042"
  ├── status: "confirmed" | "waitlisted" | "cancelled" | "attended"
  ├── isWaitlisted: boolean
  ├── waitlistPosition: number | null
  ├── paymentStatus: "paid" | "free" | "pending"
  ├── bookedAt: Timestamp
  └── checkedInAt: Timestamp | null
```

### 2.7 `lab_sessions` Collection
```
lab_sessions/{sessionId}
  ├── sessionId: string
  ├── title: string                  // e.g. "Open Lab — Arduino Workshop"
  ├── description: string
  ├── labArea: "3d_lab" | "pcb_lab" | "electronics_bench" | "general"
  ├── date: string                   // "YYYY-MM-DD"
  ├── startTime: string              // "HH:mm" 24hr
  ├── endTime: string
  ├── maxParticipants: number
  ├── currentBookings: number
  ├── availableEquipment: string[]
  ├── prerequisiteNotes: string
  ├── supervisorId: string          // ref → users (staff)
  ├── status: "open" | "full" | "cancelled" | "completed"
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

### 2.8 `lab_sessions/{sessionId}/bookings` Sub-collection
```
bookings/{bookingId}
  ├── userId: string
  ├── userName: string
  ├── userEmail: string
  ├── rollNumber: string
  ├── projectDescription: string    // What they plan to work on
  ├── equipmentNeeded: string[]
  ├── status: "confirmed" | "cancelled" | "attended" | "no_show"
  ├── bookedAt: Timestamp
  └── checkedInAt: Timestamp | null
```

### 2.9 `printers` Collection
```
printers/{printerId}
  ├── printerId: string
  ├── name: string                   // e.g. "Bambu Lab X1C #1"
  ├── type: "single_color" | "multi_color"
  ├── brand: string
  ├── model: string
  ├── buildVolume: { x: number, y: number, z: number }  // mm
  ├── maxColors: number              // 1 or 4
  ├── supportedMaterials: string[]
  ├── status: "idle" | "printing" | "maintenance" | "offline"
  ├── currentJobId: string | null
  ├── lastMaintenanceAt: Timestamp | null
  └── location: string              // Physical location in lab
```

### 2.10 `notifications` Collection
```
notifications/{notificationId}
  ├── userId: string                 // recipient
  ├── type: "job_update" | "event_confirmed" | "event_reminder" | "session_confirmed" | "indent_ready" | "system" | "staff_action"
  ├── title: string
  ├── body: string
  ├── data: map                      // arbitrary extra payload
  ├── isRead: boolean
  ├── actionURL: string | null       // deep link
  ├── createdAt: Timestamp
  └── expiresAt: Timestamp | null
```

### 2.11 `cost_config` Collection (Admin-managed)
```
cost_config/3d_printing
  ├── perGramCost: number
  ├── multiColorSurcharge: number    // flat fee
  ├── materialCosts: { PLA: number, PETG: number, ABS: number, TPU: number }
  └── minimumCharge: number

cost_config/pcb_printing
  ├── basePrice: number
  ├── perLayerPrice: number
  ├── surfaceFinishPrices: { HASL: number, ENIG: number, OSP: number }
  ├── expressSurcharge: number
  └── minimumCharge: number
```

---

## 3. Authentication & Roles

### 3.1 Student Authentication Flow
```
1. App launch → check Firebase Auth state
2. If unauthenticated → show Login screen
3. Login options:
   a. "Continue with Google" → google_sign_in package → Firebase signInWithCredential
   b. "Continue with Microsoft" → flutter_appauth + MSAL → Firebase signInWithCredential
   c. "Continue with Phone" → Firebase Phone Auth → OTP → signInWithCredential
4. On success:
   a. Check users/{uid} exists in Firestore
   b. If not → create user doc with role: "student", isApproved: true
   c. If exists → update lastLoginAt, merge new auth provider
5. Route → StudentDashboard
```

### 3.2 Staff Authentication Flow
```
1. Staff tap hidden "Staff Login" entry (long-press logo or /staff route)
2. Email + Password login ONLY (no OAuth)
3. On success:
   a. Check users/{uid}.role !== "student"
   b. Check users/{uid}.isApproved === true
   c. If isApproved === false → show "Awaiting Admin Approval" screen, sign out
4. Route → RoleDashboard based on role field
```

### 3.3 Staff Account Creation (Admin Only)
```
Admin flow:
1. Admin Console → "Create Staff Account"
2. Fill: name, email, role, department
3. Firebase Function generateStaffAccount():
   a. Create Firebase Auth user with temp password
   b. Set custom claim: { role: selectedRole }
   c. Create users/{uid} doc with isApproved: false
   d. Send email via Stitch: temp password + login instructions
4. Admin separately approves: users/{uid}.isApproved = true
5. Staff must change password on first login (enforced client-side flag)
```

### 3.4 Role Permissions Matrix

| Feature | Student | 3D Tech | PCB Tech | Event Mgr | Admin |
|---|---|---|---|---|---|
| Submit 3D Job | ✅ | ❌ | ❌ | ❌ | ✅ |
| Manage 3D Queue | ❌ | ✅ | ❌ | ❌ | ✅ |
| Submit PCB Job | ✅ | ❌ | ❌ | ❌ | ✅ |
| Manage PCB Queue | ❌ | ❌ | ✅ | ❌ | ✅ |
| Book Events | ✅ | ❌ | ❌ | ❌ | ✅ |
| Create/Edit Events | ❌ | ❌ | ❌ | ✅ | ✅ |
| Book Lab Session | ✅ | ❌ | ❌ | ❌ | ✅ |
| Manage Sessions | ❌ | ✅ | ✅ | ❌ | ✅ |
| View All Jobs | ❌ | 3D only | PCB only | ❌ | ✅ |
| Create Staff | ❌ | ❌ | ❌ | ❌ | ✅ |
| Edit Cost Config | ❌ | ❌ | ❌ | ❌ | ✅ |
| Generate Indent | Auto | Auto | Auto | ❌ | ✅ |

---

## 4. Module 1 — 3D Printing

### 4.1 Student Submission Flow
```
Step 1 — Upload Models
  - Accept: .stl, .obj, .3mf, .step
  - Max file size: 100MB per file, 5 files per job
  - Upload to Firebase Storage: models/3d/{userId}/{jobId}/{fileName}
  - Generate thumbnail server-side (Firebase Function using three.js headless)
  - Show upload progress per file

Step 2 — 3D Model Viewer
  - Embed three.js WebGL viewer in Flutter WebView OR use model_viewer_plus package
  - Controls: orbit, zoom, pan
  - Show bounding box dimensions (auto-calculated from STL parser)
  - Toggle: wireframe, solid, x-ray views

Step 3 — Printer Selection
  - Single Color: show available single-color printers with status
  - Multi-Color: show multi-color printers (Bambu-style AMS)
  - Show build volume constraints vs model dimensions (warn if model too large)

Step 4 — Color Configuration (Bambu-style)
  IF multi_color selected:
    - Show color palette panel (max 4 slots matching AMS)
    - Per slot: color picker (hex input + visual swatch), material dropdown, filament brand
    - Live preview: re-render 3D model with color regions highlighted
      (Note: color region mapping requires pre-segmented model or manual region assignment)
    - Color assignment UI: click model region → assign to slot
  IF single_color:
    - Single color picker + material selection

Step 5 — Print Settings
  - Layer height: 0.1, 0.15, 0.2, 0.25, 0.3 mm (slider)
  - Infill: 10% to 100% (slider with presets: 15/20/40/60/100)
  - Support: toggle (auto-detect overhang angle)
  - Show estimated material weight and print time (client-side estimate)

Step 6 — Review & Submit
  - Show summary: model thumbnails, colors, settings, estimated cost
  - Cost calculated client-side from cost_config/3d_printing
  - Notes field (textarea)
  - Submit → create Firestore doc → trigger Stitch webhook
```

### 4.2 Lab Tech 3D Queue Management
```
Queue View:
  - List all jobs with status chips
  - Sort: by submission time (default), priority, printer type
  - Filter: by status, printer, material

Job Detail Actions:
  - Assign to printer (dropdown of idle printers)
  - Set priority (1-5)
  - Update status with dropdown
  - Add lab notes (internal)
  - Calculate final cost (override estimate)
  - Mark payment received
  - Trigger indent form generation (Firebase Function)
  - Live print progress update panel:
      → Manual stage input OR
      → Future: Bambu Connect API webhook → auto updates

Print Progress Update (Manual):
  - Stage description (text)
  - Percent complete (0-100 slider)
  - → Writes to print_jobs_3d/{jobId}/progress_log
  - → Writes to Realtime Database: /live_progress/3d/{jobId}
  - → FCM push to student
```

### 4.3 Live Progress (Student View)
```
- Listen to Realtime Database path: /live_progress/3d/{jobId}
- Show Amazon-style order tracker:
    [Submitted] → [Queued] → [Printing] → [Post-Processing] → [Ready for Pickup]
- Progress bar with percent inside Printing stage
- Stage timestamp badges (when each stage was reached)
- Current stage message (e.g. "Layer 87 of 240 — 36%")
- Estimated completion countdown timer
- Push notification on each stage change
```

---

## 5. Module 2 — PCB Printing

### 5.1 Student Submission Flow
```
Step 1 — Upload PCB Files
  - Accept: .gbr, .ger (Gerber), .drl, .exc (Excellon drill), .brd (Eagle), .kicad_pcb, .zip (Gerber bundle), .pdf
  - Max 50MB total
  - Upload to Storage: files/pcb/{userId}/{jobId}/
  - Server-side Gerber preview generation (Firebase Function using gerbv or PCBStackup)

Step 2 — PCB Specification Form
  Mandatory fields:
  - Board layers (radio: 1/2/4/6/8)
  - Board dimensions (W × H in mm, with canvas preview showing scale)
  - Quantity (number input, 1-50)
  - Copper thickness (1oz / 2oz radio)
  - Board thickness (1.0 / 1.2 / 1.6 / 2.0 mm dropdown)
  - Surface finish (HASL / HASL Lead-free / ENIG / OSP)
  - Solder mask color (color picker: green/red/blue/black/white/yellow)
  - Silkscreen color (white/black)

  Optional / Advanced:
  - Via tenting (tented / untented / partially tented)
  - Min trace width (input, mm)
  - Min drill size (input, mm)
  - Blind vias (toggle)
  - Buried vias (toggle)
  - Castellated holes (toggle)
  - Special requirements (textarea)

Step 3 — Gerber Preview Viewer
  - Render top copper, bottom copper, silkscreen, drill layers
  - Layer visibility toggles
  - Zoom/pan controls
  - Show DRC warnings if detectable

Step 4 — Cost Estimate
  - Auto-calculated from pcb_specs + cost_config/pcb_printing
  - Show cost breakdown table

Step 5 — Submit
  - Review summary
  - Submit → Firestore doc → Stitch webhook to PCB lab
```

### 5.2 Lab Tech PCB Queue Management
```
Queue View:
  - Status pipeline: Submitted → Design Review → Approved → Queued → Etching → Drilling → Finishing → QC → Ready → Done

Design Review Stage (PCB Tech):
  - View all uploaded files inline (Gerber viewer)
  - Run DRC check (manual or automated via server function)
  - Enter review notes
  - Set designReview.drcPassed = true/false
  - If fail: set status = "rejected", notify student with notes
  - If pass: set status = "approved"

Production Stages:
  - Update status through production pipeline
  - Each status change → Realtime DB update → student FCM push
  - Add lab notes at each stage
  - Final QC: photo upload (store in Storage, add URL to job doc)

Completion:
  - Mark as ready_for_pickup
  - Set final cost
  - Trigger indent form generation
```

---

## 6. Module 3 — Event Booking

### 6.1 Event Manager — Create/Edit Event
```
Create Event Form:
  - Title, description (rich text / markdown)
  - Category (workshop/hackathon/seminar/competition/open_day/other)
  - Banner image upload (Storage: events/{eventId}/banner.jpg)
  - Date picker + start/end time
  - Registration deadline picker
  - Venue (text) + optional map link
  - Max capacity (number)
  - Waitlist toggle
  - Online toggle → show Meet link field
  - Free toggle → if not free, show fee amount
  - Tags (chip input)
  - Status: save as Draft or Publish immediately

Calendar Management:
  - Monthly/weekly grid view of all events
  - Color-coded by category
  - Drag to reschedule (updates Firestore)
  - Quick status change (publish/cancel)
```

### 6.2 Student — Event Discovery & Booking
```
Calendar View:
  - Monthly calendar (table_calendar package)
  - Events shown as colored dots on date cells
  - Category filter chips at top
  - Tap date → show event cards for that day

Event Detail Screen:
  - Banner image hero
  - Title, description, venue, time
  - Capacity bar (X of Y spots remaining)
  - Tags
  - Register button (disabled after deadline or if full)
  - If full + waitlist enabled: "Join Waitlist" button

Booking Flow:
  - Confirm booking dialog
  - Check capacity (Firestore transaction to prevent overselling):
      transaction:
        read currentRegistrations
        if < maxCapacity: increment + create booking doc (status: confirmed)
        else if waitlist: add to waitlist queue (status: waitlisted)
  - On success: show confirmation with ticket number
  - FCM push + email via Stitch

My Events (Student Dashboard):
  - Upcoming confirmed bookings (card list)
  - Past events with "attended" badge
  - Waitlisted events with position number
  - Cancel booking button (if before deadline)
```

### 6.3 Check-In Flow (Event Manager App)
```
- Event Manager opens event on day of
- QR scanner OR manual roll number lookup
- Finds booking → update status to "attended"
- Show student name + photo (from their profile)
```

---

## 7. Module 4 — Lab Session Booking

### 7.1 Session Creation (Admin / Lab Tech)
```
Create Session Form:
  - Title (e.g. "Soldering Basics Workshop")
  - Lab area (3D Lab / PCB Lab / Electronics Bench / General)
  - Date + start/end time
  - Max participants
  - Available equipment list (chip input)
  - Prerequisite notes
  - Supervisor assignment
  - Status: open/cancelled
```

### 7.2 Student Session Booking
```
Session Browser:
  - Calendar view with available session slots
  - Filter by lab area, date
  - Session card: title, time, available spots, equipment list

Booking Flow:
  - "What will you work on?" text field (required)
  - "Equipment needed?" (multi-select from session's equipment list)
  - Transaction-based booking (same as events)
  - Confirmation notification

My Sessions (Student Dashboard):
  - Upcoming sessions with countdown
  - Equipment reminder 24h before (scheduled FCM via Stitch)
  - Past sessions history
```

---

## 8. Student Dashboard

### 8.1 Dashboard Layout (Flutter)
```
Bottom Navigation:
  Tab 0: Home (Dashboard Overview)
  Tab 1: My Projects (3D + PCB jobs)
  Tab 2: Events & Sessions
  Tab 3: Notifications
  Tab 4: Profile

Home Screen Widgets:
  ┌─────────────────────────────────┐
  │ Welcome, [Name]          🔔 3   │  // name + notification badge
  ├─────────────────────────────────┤
  │ Active Jobs                     │
  │  [3D Job Card — 67% complete]  │  // live progress mini-card
  │  [PCB Job Card — In Review]    │
  ├─────────────────────────────────┤
  │ Upcoming Events (next 3)        │
  │  [Event Card] [Event Card]      │
  ├─────────────────────────────────┤
  │ Upcoming Sessions               │
  │  [Session Card]                 │
  └─────────────────────────────────┘
```

### 8.2 My Projects Screen
```
Tab bar: [3D Printing] [PCB Printing]

3D Printing Jobs List:
  - StreamBuilder on print_jobs_3d where studentId == uid
  - Each card: model thumbnail, job name, status chip, date, cost
  - Tap → Job Detail Screen

Job Detail Screen:
  - Model viewer (3D)
  - Amazon-style progress tracker (see §11)
  - Cost breakdown
  - Download Indent Form button (if indentFormURL exists)
  - Colour config display
  - Lab notes (if status is failed/rejected — show reason)
  - Cancel button (only if status is "submitted" or "queued")

PCB Jobs List:
  - Same pattern but for pcb_jobs
  - Job detail shows Gerber viewer + PCB specs + progress
```

### 8.3 Notifications Screen
```
- StreamBuilder on notifications where userId == uid, ordered by createdAt desc
- Group by: Today / This Week / Earlier
- Each item: icon (by type), title, body, timestamp, unread dot
- Tap → navigate to relevant screen (deep link via actionURL)
- Swipe to dismiss → mark as read
- Mark all read button
```

---

## 9. Staff Dashboards by Role

### 9.1 Admin Dashboard
```
Sections:
  ├── Overview Stats
  │     - Total jobs this month (3D + PCB)
  │     - Events this month + total registrations
  │     - Active students
  │     - Revenue summary
  │
  ├── User Management
  │     - All users list (filter by role)
  │     - Pending staff approvals (badge count)
  │     - Approve / Reject / Deactivate staff
  │     - Create staff account form
  │     - Reset password for staff
  │
  ├── Job Oversight
  │     - All 3D + PCB jobs (read-only view)
  │     - Override any job status
  │     - Assign/reassign technicians
  │
  ├── Printer/Equipment Management
  │     - Add/edit/deactivate printers
  │     - Set printer status
  │     - Maintenance log
  │
  ├── Cost Configuration
  │     - Edit cost_config/3d_printing
  │     - Edit cost_config/pcb_printing
  │     - Save → triggers recalculation notification to pending jobs
  │
  ├── Reports & Analytics
  │     - Jobs per week/month chart
  │     - Material consumption chart
  │     - Event attendance chart
  │     - Export CSV (Firebase Function generating CSV, returned as download)
  │
  └── System Settings
        - Institution name, logo upload
        - Indent form template customization
        - Notification templates
```

### 9.2 3D Lab Tech Dashboard
```
Main View: Job Queue
  - Kanban board: Submitted / Queued / Printing / Post-Processing / Ready
  - OR list view toggle
  - Filter: by printer, by material, by date

Job Card Actions:
  - Accept job (move to Queued)
  - Assign printer
  - Start print (move to Printing)
  - Update progress (stage + percent)
  - Mark issues / add notes
  - Complete / Mark failed
  - Generate indent

Printer Status Panel:
  - Real-time status of each printer
  - Current job on each printer
  - Quick status update (idle/maintenance/offline)

Today's Schedule:
  - List of lab sessions for today in 3D lab area
  - Participants for each session
```

### 9.3 PCB Lab Tech Dashboard
```
Similar structure to 3D Lab Tech but for PCB workflow:

Main View: PCB Job Queue
  - Pipeline: Submitted → Design Review → Approved → Queued → Etching → Drilling → Finishing → QC → Ready

Design Review Panel:
  - Queue of submitted jobs awaiting review
  - Inline Gerber viewer
  - DRC results input
  - Approve/Reject with notes

Production Update Panel:
  - Stage progression buttons
  - Photo upload for QC stage
  - Final measurement entry
```

### 9.4 Event Manager Dashboard
```
My Events:
  - Calendar view of managed events
  - Create Event button (FAB)
  - Event cards with quick-action menu (edit/cancel/duplicate)

Event Detail Management:
  - Edit all event fields
  - Registrations list (search, export CSV)
  - Send announcement to all registrants (Stitch email blast)
  - Check-in interface (QR scanner + manual)
  - Attendance stats

Session Management:
  - Create/edit lab sessions
  - View bookings per session
  - Mark attendance
```

---

## 10. Indent Form Generation

### 10.1 What the Indent Form Contains

**3D Printing Indent Form:**
```
Header:
  - Institution logo (top left)
  - "FAB LAB — 3D PRINTING REQUEST" title
  - "INDENT FORM" subtitle
  - Form number (auto: FLB-3D-{YEAR}-{SEQUENCE})
  - Date generated

Section A — Student Details:
  - Full name, Roll No., Department, Email, Phone

Section B — Project Details:
  - Project name, Description
  - Submission date, Expected completion

Section C — Model Information:
  - File names, estimated weight (g), dimensions (mm)
  - Printer type (single/multi color)
  - Color configuration table (slot | color | material | hex)

Section D — Print Specifications:
  - Layer height, Infill, Support: Yes/No

Section E — Cost Breakdown:
  - Material cost, Labour/machine cost, Surcharges
  - Total amount (₹)
  - Payment status

Section F — Lab Use Only:
  - Assigned technician signature line
  - Printer ID
  - Actual weight used
  - Completion date
  - Lab head signature

Footer:
  - Institution address, contact
  - "This is a computer-generated document"
  - QR code linking to job status page
```

**PCB Printing Indent Form:**
```
Same header structure, but:

Section C — PCB Specifications:
  - Layers, dimensions, quantity
  - Copper/board thickness
  - Surface finish, solder mask, silkscreen
  - Via type, min trace/drill
  - Special requirements

Section D — Design Review:
  - DRC status, review notes, reviewer name

Section E — Cost Breakdown (PCB-specific)
```

### 10.2 Generation Implementation
```javascript
// Firebase Function: generateIndentForm
// Trigger: Firestore onUpdate when job.indentFormURL is null and status reaches
// "ready_for_pickup" OR manual trigger from lab tech

exports.generateIndentForm = functions.https.onCall(async (data, context) => {
  const { jobId, jobType } = data; // jobType: "3d" | "pcb"

  // 1. Fetch job document
  const collection = jobType === "3d" ? "print_jobs_3d" : "pcb_jobs";
  const jobDoc = await admin.firestore().collection(collection).doc(jobId).get();
  const job = jobDoc.data();

  // 2. Fetch institution config (logo URL, name, address)
  const configDoc = await admin.firestore().collection("system_config").doc("institution").get();
  const config = configDoc.data();

  // 3. Generate PDF using PDFKit or puppeteer
  // → Build HTML template with job data + config
  // → Convert to PDF (puppeteer recommended for logo/QR support)

  // 4. Upload to Storage
  const pdfBuffer = await generatePDF(job, config, jobType);
  const filePath = `indent_forms/${jobType}/${jobId}/indent_${jobId}.pdf`;
  await admin.storage().bucket().file(filePath).save(pdfBuffer);
  const [downloadURL] = await admin.storage().bucket().file(filePath).getSignedUrl({
    action: 'read', expires: '2030-01-01'
  });

  // 5. Write URL back to job doc
  await admin.firestore().collection(collection).doc(jobId).update({
    indentFormURL: downloadURL,
    indentGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 6. Notify student
  await sendNotification(job.studentId, {
    type: "indent_ready",
    title: "Your Indent Form is Ready",
    body: `Download your indent form for ${job.projectName}`,
    actionURL: `/jobs/${jobType}/${jobId}`
  });

  return { downloadURL };
});
```

---

## 11. Real-Time Progress Tracking

### 11.1 Realtime Database Structure
```json
{
  "live_progress": {
    "3d": {
      "{jobId}": {
        "status": "printing",
        "percentComplete": 67,
        "currentStage": "Layer 134 of 200",
        "updatedAt": 1735000000000,
        "estimatedMinutesRemaining": 43
      }
    },
    "pcb": {
      "{jobId}": {
        "status": "drilling",
        "percentComplete": 55,
        "currentStage": "Drilling vias — pass 2 of 3",
        "updatedAt": 1735000000000
      }
    }
  }
}
```

### 11.2 Flutter Progress Tracker Widget
```dart
// Amazon/Swiggy-style order tracker
// Stages for 3D: Submitted → Queued → Printing → Post-Processing → Ready for Pickup → Completed
// Stages for PCB: Submitted → Design Review → Approved → In Production → QC → Ready → Completed

Widget buildProgressTracker(String jobId, String jobType) {
  return StreamBuilder(
    stream: FirebaseDatabase.instance
        .ref('live_progress/$jobType/$jobId')
        .onValue,
    builder: (context, snapshot) {
      // Build vertical stepper with:
      // - Completed stages: filled circle + checkmark + timestamp
      // - Current stage: pulsing animated circle + stage name + percent bar (for printing)
      // - Upcoming stages: hollow circle, greyed out
    }
  );
}
```

### 11.3 Lab Tech Progress Update (Flutter)
```dart
Future<void> updateJobProgress(String jobId, String jobType, {
  required String status,
  required int percentComplete,
  required String stageName,
  int? estimatedMinutesRemaining,
}) async {
  final batch = FirebaseFirestore.instance.batch();

  // 1. Update Realtime DB (instant, for live listeners)
  await FirebaseDatabase.instance
    .ref('live_progress/$jobType/$jobId')
    .set({
      'status': status,
      'percentComplete': percentComplete,
      'currentStage': stageName,
      'updatedAt': ServerValue.timestamp,
      'estimatedMinutesRemaining': estimatedMinutesRemaining,
    });

  // 2. Log to Firestore sub-collection (permanent history)
  final collection = jobType == "3d" ? "print_jobs_3d" : "pcb_jobs";
  batch.set(
    FirebaseFirestore.instance
      .collection(collection).doc(jobId)
      .collection('progress_log').doc(),
    {
      'stage': stageName,
      'percentComplete': percentComplete,
      'message': stageName,
      'updatedBy': currentUserId,
      'timestamp': FieldValue.serverTimestamp(),
    }
  );

  // 3. Update main job doc status
  batch.update(
    FirebaseFirestore.instance.collection(collection).doc(jobId),
    { 'status': status, 'updatedAt': FieldValue.serverTimestamp() }
  );

  await batch.commit();

  // 4. FCM push (via Stitch trigger or direct Firebase Function call)
  await notifyStudentOfProgress(jobId, jobType, stageName);
}
```

---

## 12. Notifications System

### 12.1 FCM Setup (Flutter)
```dart
// Initialize in main.dart
FirebaseMessaging messaging = FirebaseMessaging.instance;

// Request permission (iOS)
await messaging.requestPermission(alert: true, badge: true, sound: true);

// Get token → save to users/{uid}/notificationTokens array
String? token = await messaging.getToken();
await FirebaseFirestore.instance.collection('users').doc(uid).update({
  'notificationTokens': FieldValue.arrayUnion([token!])
});

// Handle foreground messages → show in-app snackbar/banner
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  showInAppNotification(message.notification?.title, message.notification?.body);
  // Also write to notifications collection for history
});

// Handle background tap → navigate to actionURL
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  navigateFromNotification(message.data['actionURL']);
});
```

### 12.2 Notification Triggers (Firebase Functions)

| Event | Trigger | Recipients |
|---|---|---|
| 3D job status changes | Firestore onUpdate | Student |
| PCB job status changes | Firestore onUpdate | Student |
| PCB design review fail | Firestore onUpdate | Student |
| Event booking confirmed | Firestore onCreate | Student |
| Event reminder | Scheduled function (24h before) | All event registrants |
| Session reminder | Scheduled function (24h before) | All session registrants |
| Indent form ready | Firestore onUpdate (indentFormURL set) | Student |
| Waitlist promoted | When cancellation occurs | Next waitlist student |
| Staff account pending | New staff doc | Admin |
| Staff account approved | isApproved → true | Staff member |

---

## 13. Stitch Integration Points

> Stitch acts as the orchestration middleware — connecting Firebase with external services and handling complex multi-step workflows.

### 13.1 Stitch Responsibilities
```
1. Email Service (SMTP / SendGrid via Stitch HTTP service):
   - Student booking confirmations (HTML template with event details)
   - Staff account creation (temp password delivery)
   - Job completion emails with indent form PDF attachment
   - Event reminders (bulk email to registrants)
   - Weekly digest for staff (job queue summary)

2. Webhook Bridge:
   - Receive printer status webhooks (Bambu Connect / OctoPrint) → update Firestore
   - POST to lab equipment APIs if integrated

3. PDF Generation Orchestration:
   - Stitch can trigger Firebase Function via HTTP callable
   - Or handle PDF template rendering if using Stitch's own compute

4. Scheduled Jobs:
   - Daily: clean up expired notification tokens
   - Hourly: promote waitlisted bookings for cancelled spots
   - Pre-event: send reminder emails/push 24h before

5. Cost Calculation Webhooks:
   - When job is submitted → Stitch fetches cost_config → calculates → writes estimate back

6. Antigravity Bridge:
   - Stitch exposes REST endpoints that Antigravity reads
   - Antigravity queries job status, availability, etc. via Stitch-secured endpoints
```

### 13.2 Stitch → Firebase Auth
```javascript
// Stitch service authenticated via Firebase Admin SDK service account
// Store service account JSON in Stitch secrets (never in client code)
// All Stitch → Firestore writes use Admin SDK (bypasses security rules)
```

---

## 14. Flutter App Structure

```
lib/
├── main.dart
├── firebase_options.dart           // FlutterFire CLI generated
│
├── core/
│   ├── constants/
│   │   ├── app_colors.dart
│   │   ├── app_strings.dart
│   │   └── firebase_paths.dart     // All Firestore collection path constants
│   ├── models/
│   │   ├── user_model.dart
│   │   ├── print_job_3d_model.dart
│   │   ├── pcb_job_model.dart
│   │   ├── event_model.dart
│   │   ├── booking_model.dart
│   │   ├── lab_session_model.dart
│   │   └── notification_model.dart
│   ├── services/
│   │   ├── auth_service.dart       // Google, Microsoft, Phone auth
│   │   ├── firestore_service.dart  // All Firestore CRUD
│   │   ├── storage_service.dart    // File uploads/downloads
│   │   ├── realtime_service.dart   // Realtime DB live progress
│   │   ├── notification_service.dart // FCM setup + local notifications
│   │   └── stitch_service.dart     // HTTP calls to Stitch endpoints
│   └── utils/
│       ├── validators.dart
│       ├── cost_calculator.dart
│       └── file_helpers.dart
│
├── features/
│   ├── auth/
│   │   ├── screens/
│   │   │   ├── login_screen.dart
│   │   │   └── staff_login_screen.dart
│   │   └── providers/
│   │       └── auth_provider.dart  // Riverpod / Provider
│   │
│   ├── student/
│   │   ├── dashboard/
│   │   │   └── student_dashboard_screen.dart
│   │   ├── print_3d/
│   │   │   ├── submit_3d_job_screen.dart
│   │   │   ├── model_viewer_widget.dart
│   │   │   ├── color_picker_widget.dart   // Bambu-style
│   │   │   ├── print_settings_widget.dart
│   │   │   ├── job_detail_3d_screen.dart
│   │   │   └── progress_tracker_widget.dart
│   │   ├── pcb/
│   │   │   ├── submit_pcb_job_screen.dart
│   │   │   ├── gerber_viewer_widget.dart
│   │   │   ├── pcb_spec_form_widget.dart
│   │   │   └── job_detail_pcb_screen.dart
│   │   ├── events/
│   │   │   ├── events_calendar_screen.dart
│   │   │   ├── event_detail_screen.dart
│   │   │   └── my_bookings_screen.dart
│   │   ├── sessions/
│   │   │   ├── sessions_screen.dart
│   │   │   └── session_booking_screen.dart
│   │   └── notifications/
│   │       └── notifications_screen.dart
│   │
│   └── staff/
│       ├── admin/
│       │   ├── admin_dashboard_screen.dart
│       │   ├── user_management_screen.dart
│       │   ├── cost_config_screen.dart
│       │   └── analytics_screen.dart
│       ├── lab_tech_3d/
│       │   ├── queue_3d_screen.dart
│       │   ├── job_management_3d_screen.dart
│       │   └── progress_update_widget.dart
│       ├── lab_tech_pcb/
│       │   ├── queue_pcb_screen.dart
│       │   ├── design_review_screen.dart
│       │   └── job_management_pcb_screen.dart
│       └── event_manager/
│           ├── manage_events_screen.dart
│           ├── create_event_screen.dart
│           ├── event_registrations_screen.dart
│           └── checkin_screen.dart
│
├── shared/
│   ├── widgets/
│   │   ├── status_chip_widget.dart
│   │   ├── job_card_widget.dart
│   │   ├── progress_stepper_widget.dart  // Amazon-style tracker
│   │   ├── cost_breakdown_widget.dart
│   │   └── empty_state_widget.dart
│   └── router/
│       └── app_router.dart         // GoRouter with role-based routing
│
└── functions/                      // Firebase Functions (separate Node.js project)
    ├── src/
    │   ├── index.ts
    │   ├── auth/
    │   │   └── onUserCreate.ts     // Auto-create Firestore user doc
    │   ├── jobs/
    │   │   ├── onJobStatusChange.ts // FCM trigger
    │   │   └── generateIndentForm.ts
    │   ├── events/
    │   │   ├── onBookingCreate.ts
    │   │   └── sendEventReminders.ts // Scheduled
    │   └── notifications/
    │       └── sendFCM.ts
    └── package.json
```

### 14.1 Key Flutter Packages
```yaml
# pubspec.yaml key dependencies
dependencies:
  flutter: sdk: flutter
  # Firebase
  firebase_core: ^3.x
  firebase_auth: ^5.x
  cloud_firestore: ^5.x
  firebase_storage: ^12.x
  firebase_database: ^11.x       # Realtime DB for live progress
  firebase_messaging: ^15.x
  # Auth providers
  google_sign_in: ^6.x
  flutter_appauth: ^8.x          # Microsoft OAuth
  # State management
  flutter_riverpod: ^2.x         # OR provider
  # Navigation
  go_router: ^14.x
  # UI
  table_calendar: ^3.x           # Event calendar
  model_viewer_plus: ^1.x        # 3D model viewer (three.js wrapper)
  flutter_colorpicker: ^1.x      # Color picker for filament colors
  syncfusion_flutter_pdfviewer: ^26.x  # PDF viewer for indent forms
  # File handling
  file_picker: ^8.x
  path_provider: ^2.x
  # Notifications
  flutter_local_notifications: ^18.x
  # Utils
  intl: ^0.19.x
  cached_network_image: ^3.x
  shimmer: ^3.x                  # Loading skeletons
  # QR
  mobile_scanner: ^6.x           # Check-in QR scanner
  qr_flutter: ^4.x               # Ticket QR generation
```

---

## 15. Firebase Security Rules

### 15.1 Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function hasRole(role) {
      return isAuthenticated() && getUserData().role == role;
    }

    function isApprovedStaff() {
      let u = getUserData();
      return isAuthenticated() && u.role != "student" && u.isApproved == true;
    }

    function isAdmin() {
      return hasRole("admin") && isApprovedStaff();
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && (isOwner(userId) || isAdmin());
      allow create: if isAuthenticated() && isOwner(userId);  // Students self-create
      allow update: if isAuthenticated() && (
        isOwner(userId) ||
        isAdmin() ||
        (isApprovedStaff() && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['notificationTokens', 'lastLoginAt']))
      );
      allow delete: if isAdmin();
    }

    // 3D Print Jobs
    match /print_jobs_3d/{jobId} {
      allow read: if isAuthenticated() && (
        isOwner(resource.data.studentId) ||
        hasRole("3d_tech") ||
        isAdmin()
      );
      allow create: if isAuthenticated() && hasRole("student") &&
        request.resource.data.studentId == request.auth.uid;
      allow update: if isAuthenticated() && (
        (isOwner(resource.data.studentId) &&
          request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['notes']) &&
          resource.data.status in ["submitted"]) ||
        hasRole("3d_tech") ||
        isAdmin()
      );

      match /progress_log/{logId} {
        allow read: if isAuthenticated() && (
          isOwner(get(/databases/$(database)/documents/print_jobs_3d/$(jobId)).data.studentId) ||
          hasRole("3d_tech") || isAdmin()
        );
        allow create: if hasRole("3d_tech") || isAdmin();
      }
    }

    // PCB Jobs
    match /pcb_jobs/{jobId} {
      allow read: if isAuthenticated() && (
        isOwner(resource.data.studentId) ||
        hasRole("pcb_tech") ||
        isAdmin()
      );
      allow create: if isAuthenticated() && hasRole("student") &&
        request.resource.data.studentId == request.auth.uid;
      allow update: if hasRole("pcb_tech") || isAdmin();
    }

    // Events
    match /events/{eventId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if hasRole("event_manager") || isAdmin();

      match /bookings/{bookingId} {
        allow read: if isAuthenticated() && (
          isOwner(resource.data.userId) ||
          hasRole("event_manager") ||
          isAdmin()
        );
        allow create: if isAuthenticated() && hasRole("student") &&
          request.resource.data.userId == request.auth.uid;
        allow update: if isAuthenticated() && (
          isOwner(resource.data.userId) ||
          hasRole("event_manager") ||
          isAdmin()
        );
      }
    }

    // Lab Sessions
    match /lab_sessions/{sessionId} {
      allow read: if isAuthenticated();
      allow create, update: if isApprovedStaff() || isAdmin();

      match /bookings/{bookingId} {
        allow read: if isAuthenticated() && (
          isOwner(resource.data.userId) || isApprovedStaff() || isAdmin()
        );
        allow create: if isAuthenticated() && hasRole("student");
        allow update: if isApprovedStaff() || isAdmin();
      }
    }

    // Notifications
    match /notifications/{notificationId} {
      allow read, update: if isAuthenticated() &&
        isOwner(resource.data.userId);
      allow create: if isAdmin() || isApprovedStaff();  // Staff/functions create
      allow delete: if isAuthenticated() && isOwner(resource.data.userId);
    }

    // Cost Config (admin only write)
    match /cost_config/{configId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Printers
    match /printers/{printerId} {
      allow read: if isAuthenticated();
      allow write: if hasRole("3d_tech") || isAdmin();
    }

    // System Config
    match /system_config/{configId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

### 15.2 Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /models/3d/{userId}/{jobId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 100 * 1024 * 1024  // 100MB
        && request.resource.contentType.matches('model/.*|application/.*|text/plain');
    }

    match /files/pcb/{userId}/{jobId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 50 * 1024 * 1024;  // 50MB
    }

    match /events/{eventId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;  // Tighten: event_manager only via custom claims
    }

    match /indent_forms/{jobType}/{jobId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if false;  // Only Firebase Functions (Admin SDK) can write
    }

    match /profile_photos/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024;  // 5MB
    }
  }
}
```

### 15.3 Realtime Database Rules
```json
{
  "rules": {
    "live_progress": {
      "3d": {
        "$jobId": {
          ".read": "auth != null",
          ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === '3d_tech' || root.child('users').child(auth.uid).child('role').val() === 'admin')"
        }
      },
      "pcb": {
        "$jobId": {
          ".read": "auth != null",
          ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'pcb_tech' || root.child('users').child(auth.uid).child('role').val() === 'admin')"
        }
      }
    }
  }
}
```

---

## 16. Environment Variables & Secrets

### 16.1 Flutter (.env via flutter_dotenv)
```
# Never commit these to version control
FIREBASE_WEB_API_KEY=...
FIREBASE_IOS_API_KEY=...
FIREBASE_ANDROID_API_KEY=...
FIREBASE_PROJECT_ID=fablab-xxxxx
FIREBASE_STORAGE_BUCKET=fablab-xxxxx.appspot.com
FIREBASE_MESSAGING_SENDER_ID=...

# Microsoft OAuth (MSAL)
MSAL_CLIENT_ID=...
MSAL_TENANT_ID=...
MSAL_REDIRECT_URI=msauth.com.yourapp.fablab://auth

# Stitch
STITCH_API_BASE_URL=https://webhooks.mongodb-stitch.com/api/client/v2.0/app/...
STITCH_WEBHOOK_SECRET=...
```

### 16.2 Firebase Functions (process.env via functions config)
```bash
firebase functions:config:set \
  sendgrid.api_key="SG.xxx" \
  stitch.webhook_secret="xxx" \
  institution.name="Your Institution Name" \
  institution.logo_url="https://storage.googleapis.com/..."
```

---

## 17. Critical Business Logic

### 17.1 Concurrent Booking Safety (Transactions)
```dart
// ALWAYS use Firestore transactions for capacity-limited bookings
// to prevent race conditions (two students booking last spot simultaneously)

Future<String> bookEvent(String eventId, String userId) async {
  return FirebaseFirestore.instance.runTransaction<String>((transaction) async {
    final eventRef = FirebaseFirestore.instance.collection('events').doc(eventId);
    final eventDoc = await transaction.get(eventRef);
    final event = eventDoc.data()!;

    if (event['currentRegistrations'] >= event['maxCapacity']) {
      if (event['waitlistEnabled']) {
        // Add to waitlist
        // ... get current waitlist count, assign position
        return 'waitlisted';
      }
      throw Exception('Event is full');
    }

    final bookingRef = eventRef.collection('bookings').doc();
    transaction.set(bookingRef, {
      'bookingId': bookingRef.id,
      'userId': userId,
      // ... other fields
      'status': 'confirmed',
      'bookedAt': FieldValue.serverTimestamp(),
    });
    transaction.update(eventRef, {
      'currentRegistrations': FieldValue.increment(1)
    });

    return 'confirmed';
  });
}
```

### 17.2 File Upload Chunking (Large STL/Gerber files)
```dart
// Use Firebase Storage resumable uploads for files > 5MB
Future<String> uploadLargeFile(File file, String storagePath) async {
  final ref = FirebaseStorage.instance.ref(storagePath);
  final uploadTask = ref.putFile(
    file,
    SettableMetadata(contentType: lookupMimeType(file.path)),
  );

  uploadTask.snapshotEvents.listen((TaskSnapshot snapshot) {
    final progress = snapshot.bytesTransferred / snapshot.totalBytes;
    // Update upload progress state
  });

  await uploadTask;
  return await ref.getDownloadURL();
}
```

### 17.3 Cost Calculation (Client-side estimate, server-side final)
```dart
// Client-side estimate shown before submission
double estimate3DCost({
  required double estimatedGrams,
  required String materialType,
  required String printerType,
  required Map<String, dynamic> costConfig,
}) {
  double materialCost = estimatedGrams * costConfig['materialCosts'][materialType];
  double surcharge = printerType == 'multi_color' ? costConfig['multiColorSurcharge'] : 0;
  double total = materialCost + surcharge;
  return max(total, costConfig['minimumCharge'].toDouble());
}
// NOTE: Final cost is always set by lab tech before indent generation
// Client estimate is clearly labeled "Estimated — subject to change"
```

### 17.4 Waitlist Auto-Promotion
```typescript
// Firebase Function triggered on booking cancellation
export const onBookingCancelled = functions.firestore
  .document('events/{eventId}/bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== 'cancelled' && after.status === 'cancelled') {
      const { eventId } = context.params;

      // Find first waitlisted booking (lowest waitlistPosition)
      const waitlistQuery = await admin.firestore()
        .collection(`events/${eventId}/bookings`)
        .where('status', '==', 'waitlisted')
        .orderBy('waitlistPosition')
        .limit(1)
        .get();

      if (!waitlistQuery.empty) {
        const nextInLine = waitlistQuery.docs[0];
        await nextInLine.ref.update({ status: 'confirmed', isWaitlisted: false });
        await admin.firestore().collection('events').doc(eventId).update({
          currentRegistrations: admin.firestore.FieldValue.increment(1)
        });
        // Send FCM + email to promoted student
      }
    }
  });
```

---

## 18. File Storage Strategy

```
Firebase Storage Bucket Structure:
fablab-xxxxx.appspot.com/
│
├── models/
│   └── 3d/
│       └── {userId}/
│           └── {jobId}/
│               ├── {model.stl}          // Original upload
│               └── thumbnail_{model}.png // Server-generated
│
├── files/
│   └── pcb/
│       └── {userId}/
│           └── {jobId}/
│               ├── {gerbers.zip}
│               └── preview_top.png      // Gerber layer preview
│
├── events/
│   └── {eventId}/
│       └── banner.jpg
│
├── indent_forms/
│   ├── 3d/
│   │   └── {jobId}/
│   │       └── indent_{jobId}.pdf
│   └── pcb/
│       └── {jobId}/
│           └── indent_{jobId}.pdf
│
├── profile_photos/
│   └── {userId}/
│       └── avatar.jpg
│
├── qc_photos/
│   └── pcb/
│       └── {jobId}/
│           └── qc_{timestamp}.jpg
│
└── system/
    └── institution/
        ├── logo.png
        └── logo_dark.png
```

**Retention Policy (set via GCS lifecycle rules):**
- `models/3d/**` — delete 90 days after job completion
- `files/pcb/**` — delete 180 days after job completion
- `indent_forms/**` — retain indefinitely (legal documents)
- `qc_photos/**` — retain 1 year

---

## 19. Antigravity Agent Instructions

> This section is specifically for Antigravity to understand context, data sources, and how to assist users intelligently.

### 19.1 What Antigravity Does in This App
Antigravity is the AI assistance layer that helps students and staff through natural language. It reads from Firebase/Stitch and guides users without requiring them to navigate complex UI flows manually.

### 19.2 Collections Antigravity May Query
```
READ access (via Stitch-secured REST API or direct SDK):
- users/{uid}                    — user profile, role
- print_jobs_3d (student's own) — their job status, history
- pcb_jobs (student's own)      — their job status, history
- events (published only)        — event discovery
- lab_sessions (open only)       — session availability
- cost_config                    — pricing info
- printers                       — printer availability

Antigravity does NOT directly query:
- Other students' job data
- Staff internal lab notes
- System config (sensitive keys)
- Auth tokens or credential data
```

### 19.3 Student-Facing Agent Capabilities
```
1. Job Status:
   "Where is my 3D print?" → query print_jobs_3d by studentId, return current status + stage

2. Job Submission Guidance:
   "How do I submit a PCB job?" → step-by-step walkthrough of submission flow
   "What file format should I use?" → context-aware answer based on module

3. Cost Estimation:
   "How much will this print cost?" → query cost_config, compute estimate from provided specs

4. Event Discovery:
   "What events are happening this week?" → query events by date range, return formatted list
   "Is there a soldering workshop?" → full-text-like query on event tags and title

5. Session Booking Help:
   "Can I book a lab session for Friday?" → query lab_sessions for available slots on date

6. Notifications Recap:
   "What did I miss?" → query notifications for uid, summarize unread

7. Printer Guidance:
   "Which printer should I use for multicolor?" → query printers collection, recommend based on specs
```

### 19.4 Staff-Facing Agent Capabilities
```
1. Queue Summary (Lab Tech):
   "How many jobs are in the queue?" → count print_jobs_3d by status

2. Printer Status (3D Tech):
   "Which printers are free?" → query printers where status == idle

3. Event Stats (Event Manager):
   "How many registered for tomorrow's workshop?" → query event bookings count

4. Admin Reports:
   "Summarize this week's activity" → aggregate jobs, events, sessions data
```

### 19.5 Antigravity Conversation Context Schema
```json
{
  "userId": "firebase-uid",
  "userRole": "student | 3d_tech | pcb_tech | event_manager | admin",
  "sessionContext": {
    "currentScreen": "job_detail | event_detail | dashboard | null",
    "currentJobId": "string | null",
    "currentEventId": "string | null"
  },
  "permissions": {
    "canQueryOwnJobs": true,
    "canQueryAllJobs": false,
    "canQueryCostConfig": true,
    "canQueryEvents": true
  }
}
```

### 19.6 Antigravity Response Format
```
- Always be concise and action-oriented
- If querying Firestore: show a loading indicator, then result
- For navigation actions: deep link using GoRouter paths
- Format job statuses as human-readable: "Your print is 67% done — about 43 minutes left"
- Format costs with ₹ symbol and INR
- Never expose raw Firestore document IDs in responses
- If permission denied: "I don't have access to that information"
```

### 19.7 GoRouter Deep Link Paths (for Antigravity Navigation)
```
/student/dashboard
/student/jobs/3d/{jobId}
/student/jobs/pcb/{jobId}
/student/jobs/3d/submit
/student/jobs/pcb/submit
/student/events
/student/events/{eventId}
/student/sessions
/student/sessions/{sessionId}/book
/student/notifications

/staff/admin/dashboard
/staff/admin/users
/staff/lab3d/queue
/staff/lab3d/jobs/{jobId}
/staff/labpcb/queue
/staff/labpcb/jobs/{jobId}
/staff/events/manage
/staff/events/{eventId}/manage
```

---

## 20. Responsive Design & Desktop/Mobile Layout

### 20.1 Platform Targets & Build Matrix

| Platform | Target | Flutter Config |
|---|---|---|
| Android | Phone + Tablet | `flutter build apk / appbundle` |
| iOS | iPhone + iPad | `flutter build ipa` |
| Web | Desktop browser (Chrome/Edge/Firefox) | `flutter build web --release` |
| macOS | Native desktop app | `flutter build macos` |
| Windows | Native desktop app | `flutter build windows` |

> **Single codebase principle:** No separate apps. All platform differences handled via responsive layout classes, `Platform.isDesktop`, and adaptive widgets. `flutter/foundation.dart` `kIsWeb` and `dart:io` `Platform` are used for platform branching only where unavoidable (e.g. file picker, window title bar).

---

### 20.2 Breakpoint System

Define a global `ScreenSize` utility used throughout the app:

```dart
// core/utils/screen_size.dart
enum ScreenLayout { mobile, tablet, desktop }

class ScreenSize {
  static const double mobileMax = 600;
  static const double tabletMax = 1024;

  static ScreenLayout of(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < mobileMax) return ScreenLayout.mobile;
    if (width < tabletMax) return ScreenLayout.tablet;
    return ScreenLayout.desktop;
  }

  static bool isMobile(BuildContext context) => of(context) == ScreenLayout.mobile;
  static bool isTablet(BuildContext context) => of(context) == ScreenLayout.tablet;
  static bool isDesktop(BuildContext context) => of(context) == ScreenLayout.desktop;
}
```

Use via `LayoutBuilder` or `AdaptiveBuilder` wrapper:
```dart
LayoutBuilder(builder: (context, constraints) {
  if (constraints.maxWidth >= 1024) return DesktopScaffold(child: content);
  if (constraints.maxWidth >= 600) return TabletScaffold(child: content);
  return MobileScaffold(child: content);
})
```

---

### 20.3 Navigation Pattern by Platform

#### Mobile (< 600px)
```
- Bottom NavigationBar (5 tabs: Home / Projects / Events / Notifications / Profile)
- Full-screen page pushes
- Drawer for secondary navigation
- FAB for primary actions (submit job, book event)
```

#### Tablet (600–1024px)
```
- NavigationRail (left side, collapsed icon-only)
- Master-detail layout where applicable:
    - Job list (left panel, 40%) + Job detail (right panel, 60%)
    - Event list + Event detail side-by-side
- Modal bottom sheets replaced with side panels
```

#### Desktop (> 1024px)
```
- Persistent NavigationDrawer (left sidebar, 240px wide, always expanded with labels)
- Two-panel or three-panel layouts:
    - Sidebar (240px) + Main content (flex) + Optional detail panel (380px)
- Hover states on all interactive elements
- Right-click context menus for power users (staff dashboards)
- Keyboard shortcuts (see §20.8)
- Window title bar: show current section name
- Resizable panels via drag handles (admin dashboard)
- Horizontal scrollable data tables instead of card stacks
```

---

### 20.4 Adaptive Scaffold Pattern

```dart
// shared/widgets/adaptive_scaffold.dart
class AdaptiveScaffold extends StatelessWidget {
  final Widget body;
  final List<NavDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    final layout = ScreenSize.of(context);

    return switch (layout) {
      ScreenLayout.mobile => Scaffold(
          body: body,
          bottomNavigationBar: NavigationBar(
            destinations: destinations.map((d) => d.toNavigationDestination()).toList(),
            selectedIndex: selectedIndex,
            onDestinationSelected: onDestinationSelected,
          ),
          floatingActionButton: floatingActionButton,
        ),

      ScreenLayout.tablet => Scaffold(
          body: Row(children: [
            NavigationRail(
              destinations: destinations.map((d) => d.toRailDestination()).toList(),
              selectedIndex: selectedIndex,
              onDestinationSelected: onDestinationSelected,
              labelType: NavigationRailLabelType.selected,
            ),
            const VerticalDivider(width: 1),
            Expanded(child: body),
          ]),
          floatingActionButton: floatingActionButton,
        ),

      ScreenLayout.desktop => Scaffold(
          body: Row(children: [
            NavigationDrawer(
              selectedIndex: selectedIndex,
              onDestinationSelected: onDestinationSelected,
              children: [
                DrawerHeader(child: InstitutionLogoWidget()),
                ...destinations.map((d) => d.toDrawerDestination()),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: body),
          ]),
        ),
    };
  }
}
```

---

### 20.5 Screen-by-Screen Responsive Behaviour

#### Student Dashboard — Home
```
Mobile:
  - Single column scroll
  - Active job cards stacked vertically
  - Event cards in horizontal scroll row

Tablet:
  - 2-column grid for job cards + event cards

Desktop:
  - 3-column grid layout:
      Col 1 (narrow): Active jobs list
      Col 2 (wide):   3D/PCB progress tracker (expanded)
      Col 3 (narrow): Upcoming events + sessions
  - Stats bar at top: jobs submitted / events attended / sessions booked
```

#### 3D Job Submission — Multi-step Form
```
Mobile:
  - Full-screen stepper (Step 1 → 2 → 3 → 4 → 5)
  - 3D viewer full width, min height 280px

Tablet:
  - Stepper indicators at top
  - 3D viewer (left 50%) + settings panel (right 50%) on step 3+

Desktop:
  - Persistent left sidebar shows step progress tracker
  - Main area: 3D viewer (left 55%) always visible
  - Right panel (45%): scrollable form steps
  - Submit button always visible in sticky footer on right panel
  - Drag-and-drop file upload zone (desktop browsers + macOS/Windows)
```

#### PCB Job Submission
```
Mobile:
  - Sequential form steps, Gerber viewer full width

Desktop:
  - Split view: Gerber layer viewer (left, tabbed: top/bottom/silk/drill)
  - Spec form (right, scrollable)
  - Both panels visible simultaneously — user sees live spec impact on cost as they type
```

#### Job Queue (Lab Tech)
```
Mobile:
  - Vertical list with status filter chips at top
  - Tap card → full-screen job detail

Tablet:
  - Kanban board (horizontal scroll between columns)

Desktop:
  - Full Kanban board (all columns visible without scrolling, min 1200px)
  - Drag-and-drop cards between status columns
  - Click card → right detail panel slides in (no full-screen nav)
  - Data table view toggle (dense list with sortable columns)
  - Bulk actions: multi-select → assign technician / change status
```

#### Event Calendar
```
Mobile:
  - Monthly calendar (compact), events as colored dots
  - Tap date → bottom sheet with event list for that day

Tablet:
  - Monthly calendar (full width)
  - Event list below calendar

Desktop:
  - Full month grid calendar (left 60%)
  - Upcoming events list panel (right 40%, sticky)
  - Hover on calendar date cell → tooltip preview of events
  - Week/month/agenda view toggle in toolbar
```

#### Notifications
```
Mobile: Full-screen list
Desktop: Notification panel slides in from right (drawer-style, 400px wide) without leaving current screen
```

#### Admin Dashboard
```
Mobile:
  - Tabbed sections (Overview / Users / Jobs / Settings)
  - Stat cards stack vertically

Desktop:
  - Full analytics dashboard:
      Top row: 4 KPI stat cards (jobs / revenue / events / active users)
      Middle row: Line chart (jobs over time) + Pie chart (material usage)
      Bottom row: Recent activity feed + Pending approvals list
  - User management: full data table with pagination, search, sortable columns
  - Cost config: inline editable table (no separate screen)
  - Resizable panels
```

---

### 20.6 Desktop-Specific Features

#### Drag-and-Drop File Upload
```dart
// On desktop (web + macOS + Windows), wrap upload zones with DropTarget
// Use desktop_drop package
import 'package:desktop_drop/desktop_drop.dart';

DropTarget(
  onDragDone: (details) {
    final files = details.files;
    for (final file in files) {
      handleFileUpload(File(file.path));
    }
  },
  child: UploadZoneWidget(
    hint: isDragging
      ? "Drop files here"
      : "Drag & drop .STL / .OBJ / .3MF files here, or tap to browse",
  ),
)
```

#### Keyboard Shortcuts (Desktop + Web)
```dart
// Use Shortcuts + Actions widgets or CallbackShortcuts
final shortcuts = {
  // Global
  LogicalKeySet(LogicalKeyboardKey.slash): SearchIntent(),
  LogicalKeySet(LogicalKeyboardKey.escape): DismissIntent(),

  // Student
  LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyN): NewJobIntent(),

  // Lab Tech (when queue is focused)
  LogicalKeySet(LogicalKeyboardKey.arrowDown): NextJobIntent(),
  LogicalKeySet(LogicalKeyboardKey.arrowUp): PrevJobIntent(),
  LogicalKeySet(LogicalKeyboardKey.enter): OpenJobDetailIntent(),
  LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyU): UpdateProgressIntent(),
};
```

| Shortcut | Action |
|---|---|
| `/` | Focus global search |
| `Ctrl+N` | New job submission |
| `Esc` | Close panel / go back |
| `Ctrl+D` | Download indent form (when viewing job) |
| `↑ / ↓` | Navigate job list (lab tech queue) |
| `Enter` | Open selected job detail |
| `Ctrl+R` | Refresh current view |

#### Window Management (macOS / Windows native)
```dart
// Use window_manager package for native desktop
import 'package:window_manager/window_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kIsWeb && (Platform.isMacOS || Platform.isWindows || Platform.isLinux)) {
    await windowManager.ensureInitialized();
    WindowOptions windowOptions = const WindowOptions(
      size: Size(1280, 800),
      minimumSize: Size(900, 600),
      title: 'FabLab Management Platform',
      center: true,
      backgroundColor: Colors.transparent,
      titleBarStyle: TitleBarStyle.normal,
    );
    windowManager.waitUntilReadyToShow(windowOptions, () async {
      await windowManager.show();
      await windowManager.focus();
    });
  }
  runApp(const FabLabApp());
}
```

#### Context Menus (Desktop Right-Click)
```dart
// On lab tech job queue — right-click job card for quick actions
GestureDetector(
  onSecondaryTapDown: (details) {
    showMenu(
      context: context,
      position: RelativeRect.fromLTRB(
        details.globalPosition.dx, details.globalPosition.dy, 0, 0),
      items: [
        PopupMenuItem(value: 'assign', child: Text('Assign Printer')),
        PopupMenuItem(value: 'update', child: Text('Update Progress')),
        PopupMenuItem(value: 'indent', child: Text('Generate Indent')),
        PopupMenuDivider(),
        PopupMenuItem(value: 'cancel', child: Text('Cancel Job', style: TextStyle(color: Colors.red))),
      ],
    );
  },
  child: JobCard(job: job),
)
```

---

### 20.7 Mobile-Specific Features

#### Bottom Sheet Patterns (replace dialogs on mobile)
```dart
// On mobile: use showModalBottomSheet for confirmations, filter panels, quick actions
// On tablet/desktop: use showDialog or side panel instead
void showActionPanel(BuildContext context, Widget content) {
  if (ScreenSize.isMobile(context)) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        builder: (_, controller) => SingleChildScrollView(
          controller: controller,
          child: content,
        ),
      ),
    );
  } else {
    showDialog(context: context, builder: (_) => Dialog(child: content));
  }
}
```

#### Pull-to-Refresh (mobile only)
```dart
// Wrap mobile list views with RefreshIndicator
// On desktop, provide an explicit refresh button in the toolbar
Widget buildJobList(BuildContext context) {
  final list = JobListView(jobs: jobs);
  if (ScreenSize.isMobile(context)) {
    return RefreshIndicator(
      onRefresh: () => ref.refresh(jobsProvider.future),
      child: list,
    );
  }
  return list; // Desktop: toolbar has refresh icon button
}
```

#### Swipe Actions (mobile only)
```dart
// Job cards: swipe left to reveal quick action buttons
// Events: swipe left to cancel booking
if (ScreenSize.isMobile(context))
  return Dismissible(
    key: Key(job.jobId),
    direction: DismissDirection.endToStart,
    confirmDismiss: (_) => confirmCancelJob(context, job),
    background: Container(
      color: Colors.red,
      alignment: Alignment.centerRight,
      padding: EdgeInsets.only(right: 20),
      child: Icon(Icons.cancel, color: Colors.white),
    ),
    child: JobCard(job: job),
  );
```

#### Phone Authentication (mobile only)
```dart
// Phone OTP auth is only shown on mobile platforms
// On web/desktop: only Google and Microsoft OAuth shown
List<Widget> buildLoginOptions(BuildContext context) {
  return [
    GoogleSignInButton(onPressed: authService.signInWithGoogle),
    MicrosoftSignInButton(onPressed: authService.signInWithMicrosoft),
    if (!kIsWeb && (Platform.isAndroid || Platform.isIOS))
      PhoneSignInButton(onPressed: () => showPhoneAuthSheet(context)),
  ];
}
```

---

### 20.8 Responsive Typography & Spacing

```dart
// core/constants/app_theme.dart
class AppTypography {
  static TextStyle headlineLarge(BuildContext context) {
    final isDesktop = ScreenSize.isDesktop(context);
    return TextStyle(
      fontSize: isDesktop ? 32 : 24,
      fontWeight: FontWeight.w700,
    );
  }

  static TextStyle bodyMedium(BuildContext context) {
    return TextStyle(fontSize: ScreenSize.isDesktop(context) ? 15 : 14);
  }
}

// Adaptive padding helper
EdgeInsets screenPadding(BuildContext context) {
  return switch (ScreenSize.of(context)) {
    ScreenLayout.mobile  => const EdgeInsets.all(16),
    ScreenLayout.tablet  => const EdgeInsets.all(24),
    ScreenLayout.desktop => const EdgeInsets.symmetric(horizontal: 40, vertical: 28),
  };
}

// Grid column count helper
int gridColumns(BuildContext context) {
  return switch (ScreenSize.of(context)) {
    ScreenLayout.mobile  => 1,
    ScreenLayout.tablet  => 2,
    ScreenLayout.desktop => 3,
  };
}
```

---

### 20.9 3D Model Viewer — Responsive Behaviour

```
Mobile:
  - model_viewer_plus in full-width container, height = 45% of screen height
  - Pinch-to-zoom, single finger orbit
  - Toolbar (wireframe/solid/x-ray) as bottom icon row

Tablet:
  - Viewer height = 55% of screen
  - Toolbar as floating overlay in top-right corner

Desktop:
  - Viewer always visible in left panel (see §20.5)
  - Mouse scroll = zoom, left-drag = orbit, right-drag = pan
  - Keyboard: [W]ireframe, [S]olid, [X]-ray, [R]eset view
  - Download STL button in viewer toolbar (desktop only)
```

---

### 20.10 Additional Packages for Multi-Platform

```yaml
# Add to pubspec.yaml

# Desktop file drag-and-drop
desktop_drop: ^0.4.4

# Native window management (macOS/Windows/Linux)
window_manager: ^0.3.9

# Cross-platform file picker (already handles all platforms)
file_picker: ^8.x   # already listed — ensure desktop support enabled

# Responsive layout helpers
flutter_adaptive_scaffold: ^0.2.x   # Material 3 adaptive scaffold (optional, or roll own)

# Web: URL strategy (remove # from web URLs)
go_router: ^14.x   # already listed — configure PathUrlStrategy for web

# Context menus
context_menus: ^2.0.0   # OR use Flutter's built-in ContextMenuRegion (Flutter 3.3+)

# Hover effects (desktop/web only renders, no-op on mobile)
# Built into Flutter's MouseRegion widget — no extra package needed
```

---

### 20.11 Web-Specific Considerations

#### URL Strategy (clean URLs, no `#`)
```dart
// main.dart
import 'package:flutter_web_plugins/url_strategy.dart';

void main() async {
  usePathUrlStrategy(); // removes #/ from web URLs → /student/dashboard
  await Firebase.initializeApp(...);
  runApp(FabLabApp());
}
```

#### Deep Links on Web
```dart
// GoRouter handles web URL routing automatically
// Staff can bookmark: https://fablab.institution.edu/staff/lab3d/queue
// Students can share: https://fablab.institution.edu/events/EVT-2024-42
```

#### Web Auth Popup vs Redirect
```dart
// On web, Google/Microsoft OAuth uses popup by default
// If popup blocked, fallback to redirect
Future<void> signInWithGoogleWeb() async {
  final provider = GoogleAuthProvider();
  try {
    await FirebaseAuth.instance.signInWithPopup(provider);
  } on FirebaseAuthException catch (e) {
    if (e.code == 'popup-blocked') {
      await FirebaseAuth.instance.signInWithRedirect(provider);
    }
  }
}
```

#### Web Performance — Code Splitting
```
- Use deferred loading for heavy modules (Gerber viewer, 3D viewer)
- Lazy-load staff dashboards (students never load PCB queue code)
- Use Flutter's deferred components or manual import deferral
```

#### Browser Tab Title
```dart
// Update browser tab title dynamically on web
import 'package:flutter/foundation.dart';
// In each screen's initState:
if (kIsWeb) {
  // Use js interop or document_title package
  document.title = 'FabLab — 3D Print Jobs';
}
```

---

### 20.12 Responsive Testing Checklist

Before shipping each feature screen, verify at these sizes:

| Width | Represents | Must pass |
|---|---|---|
| 360px | Small Android phone | All functionality accessible, no overflow |
| 390px | iPhone 14 | All functionality accessible |
| 600px | Small tablet / large phone landscape | Rail navigation switches in |
| 768px | iPad portrait | Master-detail layout active |
| 1024px | iPad landscape / small laptop | Desktop nav switches in |
| 1280px | Standard laptop | Full desktop layout, all panels visible |
| 1440px | Large monitor | No excessive empty space, max-width container applied |
| 1920px | Full HD monitor | Content centered with max-width 1400px, side margins |

**Max-width container on desktop (prevents ultra-wide layout issues):**
```dart
// Wrap main content area with max-width constraint
Center(
  child: ConstrainedBox(
    constraints: const BoxConstraints(maxWidth: 1400),
    child: content,
  ),
)
```

---

*Document version: 1.1 — Added §20 Responsive Design & Desktop/Mobile Layout*

---

## Appendix A — Development Phases

### Phase 1 (Foundation — Weeks 1–3)
- Firebase project setup + FlutterFire initialization
- Enable Flutter desktop targets: `flutter config --enable-macos-desktop --enable-windows-desktop --enable-web`
- Auth flow: Google, Microsoft, Phone (students) + email/password (staff)
  - Web: popup/redirect OAuth
  - Mobile: native Google Sign-In + phone OTP
  - Desktop: webview-based OAuth flow
- User model + Firestore security rules
- Adaptive scaffold (§20.4) — single scaffold driving mobile/tablet/desktop nav
- Breakpoint system (§20.2) implemented globally
- Basic routing with GoRouter + `usePathUrlStrategy()` for web clean URLs
- Student dashboard shell + staff dashboard shells (responsive)

### Phase 2 (3D Printing Module — Weeks 4–6)
- File upload + 3D model viewer
- Color picker UI (Bambu-style)
- Job submission form + Firestore integration
- Lab tech queue view
- Real-time progress tracker (Realtime DB)
- FCM push notifications for job updates

### Phase 3 (PCB Module — Weeks 7–8)
- Gerber file upload + viewer
- PCB spec form
- Design review workflow
- PCB production pipeline status

### Phase 4 (Events + Sessions — Weeks 9–10)
- Event calendar (table_calendar)
- Event CRUD (event manager)
- Booking with transaction safety
- Waitlist logic
- Lab session booking

### Phase 5 (Indent Forms + Polish — Weeks 11–12)
- PDF generation Firebase Function
- Indent form templates (3D + PCB)
- Student dashboard polish
- Notification history screen
- Admin dashboard + cost config

### Phase 6 (Stitch + Antigravity + Cross-Platform Polish — Weeks 13–15)
- Stitch email service integration
- Scheduled notifications (reminders)
- Antigravity context setup + query endpoints
- Drag-and-drop file upload (desktop_drop) for desktop/web
- Keyboard shortcuts for staff dashboards
- Window manager setup for macOS/Windows native builds
- Responsive testing matrix (§20.12) — all screens at all breakpoints
- Web build: clean URLs, tab titles, lazy loading heavy modules
- End-to-end testing across platforms

---

## Appendix B — Known Edge Cases to Handle

1. **Model too large for selected printer** — warn before submission, show max build volume
2. **PCB spec incompatibility** — warn if blind vias selected with < 4 layers
3. **Student cancels job mid-print** — only allow cancellation if status is "submitted" or "queued"
4. **Double-booking prevention** — transaction-based, also disable button immediately after tap
5. **File upload interruption** — resumable uploads, store `storagePath` as soon as upload starts, handle incomplete uploads
6. **Staff account password on first login** — force password change via Firebase Auth `forceRefreshToken` flow
7. **Multiple auth providers** — same email via Google and Phone should merge (check by email before creating new user doc)
8. **Printer goes offline mid-job** — update printer status, notify lab tech, pause job progress updates
9. **Event capacity race condition** — always use Firestore transactions, never increment without transaction
10. **Indent form regeneration** — if cost changes after indent was generated, mark old URL as stale and regenerate

---

*Document version: 1.0 | Generated for Antigravity AI agent context and full-stack development reference*
*Stack: Flutter · Firebase (Auth, Firestore, Storage, Realtime DB, Functions) · Stitch · Antigravity*
