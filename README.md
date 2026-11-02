# REVA AICTE IDEA Lab Portal (v6.1.2)

A state-of-the-art web application designed for the **REVA University AICTE IDEA Lab** to manage professional engineering workflows, equipment reservations, and community engagement.

---

## 🚀 Recent Optimizations (v6.1.2)

- **Mobile First Excellence**: Complete UI overhaul for mobile devices. All dashboards, modals, and sidesheets are now optimized with scrollable containers, safe-area padding, and touch-friendly interactions.
- **Smart Access Levels**: Automated access categorization based on email domains. 
  - **Staff Access**: Full administrative control for IDEA Lab employees.
  - **University Access**: Students sign in with their REVA Microsoft account (`@reva.edu.in` only) and get full access to equipment, inventory and training.
  - **General Access**: Visitors from outside REVA sign in with Google and can use public services (events, 3D printing, PCB orders).
  - **Sign-in Log**: Every sign-in (and refused attempt) is recorded in separate, append-only databases (Microsoft and Google kept apart); admins see counts per day and per method and can export a CSV.
- **Order Tracking v2**: Reimagined live order status carousel showing real-time stages for 3D Prints and PCB Assembly with contextual collection notices.

---

## 🛠️ Core Technology Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Framer Motion.
- **Backend**: Node.js + Express API (TypeScript) serving the API and the built site.
- **Database**: MongoDB 7 (Docker, on the same AWS server). Uploaded files are stored on the server's disk.
- **Authentication**: Microsoft sign-in (REVA's Microsoft 365, `@reva.edu.in`) for students and staff with full access; Google sign-in for visitors from outside REVA with general access; plus one emergency administrator password. Admin emails are sent with Amazon SES.
- **Hosting**: AWS EC2 with Docker Compose and nginx. No Supabase, Firebase or Vercel.
- **Payments**: Razorpay (verified on the server), with automatic cancellation of unpaid orders.
- **3D Engine**: Three.js + React Three Fiber for real-time STL visualization.
- **Document Processing**: Custom receipt generation (PDF) with staff approval tracking.

---

## 📱 Features & Modules

### Student Dashboard
- **Active Order Carousel**: At-a-glance status of your most recent project.
- **3D Print Lab**: Automated STL analysis (volume, surface area, bounding box) and visual verification.
- **PCB Assembly**: Multi-step configuration flow for custom circuit board manufacturing.
- **Slot Booking**: Reserve high-end equipment or a workspace for individual/team projects.
- **Account Management**: Profile customization and historical order archives.

### Staff Dashboard (Role-Based)
- **ADMIN**: System-wide oversight and configuration.
- **LAB**: Workflow management, print job oversight, and order approvals.
- **AMBASSADOR**: Content management (Projects, Gallery, Infrastructure updates).
- **EVENT MANAGER**: Lab closure scheduling and event synchronization.

---

## 📂 Project Structure

```text
.
├── server/             # Express API + MongoDB (see README_BACKEND.md), tests in server/test
├── scripts/            # create-admin, seed-demo, one-time Supabase migration
├── deploy/             # nginx site, MongoDB init script, backup script
├── src/
│   ├── components/      # Reusable UI Atoms & Molecules (DashboardNavbar, SideDrawer, etc.)
│   ├── pages/          # Page-level containers (UserDashboard, StaffDashboard, STLViewer)
│   ├── services/       # API client
│   └── utils/          # Core utilities (Lab Closure checks, PDF Generation)
├── public/             # Static assets (Optimized image assets <500KB)
├── docker-compose.yml  # App + MongoDB for the AWS server
└── README.md
```

---

## ⚙️ Local Development

See [TESTING.md](./TESTING.md) for the full step-by-step. In short:

```bash
docker run -d --name idealab-mongo -p 127.0.0.1:27017:27017 mongo:7
cp .env.example .env        # set JWT_SECRET, PUBLIC_URL=http://localhost:3001, MONGODB_URI, MS_* (from the mock)
npm ci
npm test                    # API + security tests against the local MongoDB
npm run mock:microsoft      # separate terminal: local stand-in for Microsoft sign-in
npm run mock:google         # optional, another terminal: local stand-in for Google sign-in
npm run build && npm run seed:demo && npm start   # http://localhost:3001
```

Deploying to AWS: [DEPLOYMENT.md](./DEPLOYMENT.md). Security review: [SECURITY.md](./SECURITY.md).

---

## 🏛️ REVA University AICTE IDEA Lab
Dedicated to fostering innovation by providing state-of-the-art infrastructure for 3D printing, PCB design, and advanced rapid prototyping.
