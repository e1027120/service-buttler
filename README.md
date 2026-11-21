# Service Buttler ⛪

A production-ready web application designed for live church services. Attendees scan a seat-back **QR code** or tap an **NFC tag** once to access a live, single-action landing page on their phones.

As the service progresses, their screens update automatically: **welcome announcements**, **sermon notes** (with interactive outline and personal note-taking), **live polls** (real-time voting and live charts), **offering options** (online giving links and copyable bank details), and **digital connect/prayer cards**.

Built natively on Cloudflare for zero-downtime, global high performance:
- **Frontend & Admin**: React + TypeScript + Tailwind CSS (code-split, responsive mobile-first attendee view).
- **Edge Backend**: Cloudflare Pages Functions (edge-cached live API to handle simultaneous congregation traffic spikes).
- **Database**: Cloudflare D1 (SQLite at the edge, schema in `d1/schema.sql`).
- **Media Storage**: Cloudflare R2 (`service-buttler-assets`) served via `/api/assets/:churchId/:file` with immutable CDN caching.
- **Auth & Email**: Web Crypto PBKDF2 password hashing + HTTP session tokens + Magic Link & team invitations via Resend.
- **Automated CI/CD**: Cloudflare Pages Git integration builds and deploys on every push to `main`.

---

## 📖 Architecture & Features

### 1. Attendee Single-Action Page (`/c/:churchSlug` or `/c/:churchSlug/:serviceSlug`)
- **Zero App Install**: Served instantly via browser on any modern iOS/Android device.
- **Time-based Action Resolution**: Displays the configured action for the current minute of the service (e.g. `+10m` notes, `+45m` live poll, `+60m` offering).
- **AV Control Room Override (Live Pinning)**: Production teams can "Push Live" any action with 1 click to pin it immediately on attendee screens.
- **Live Polls**: Interactive voting with device fingerprinting (one vote per phone) and real-time aggregated results.
- **Interactive Sermon Notes**: Attendees can type private notes saved directly to local storage and export/share them.
- **Offering & Giving**: Direct links to payment providers and one-tap copyable bank/IBAN details.
- **Digital Connect / Prayer Cards & Q&A**: Custom forms and live audience questions.
- **Between Services / Idle State**: Automatically shows upcoming service countdown, church branding, custom links, and welcome messaging.

### 2. Multi-Tenant Admin Backend (`/admin`)
- **Multi-Church Membership**: A single account can belong to multiple churches with dedicated roles (`owner`, `admin`, `editor`).
- **Services & Times Manager**: Recurring weekly or specific-date services with configurable lead/trail live windows.
- **Waterfall Timeline & Action Builder**: Drag-and-drop timeline with relative service clock times, live playhead cursor, priorities, and reusable slide/sermon libraries.
- **Branding & Landing Page Customizer**: Primary & accent colors, R2-hosted logos & hero banners, themes (`light`, `dark`, `brand`), custom footer links, editable welcome modal, and live mobile preview.
- **QR Code & NFC Tag Generator**: High-resolution (1024×1024) brand-tinted PNG QR codes and NFC tag instructions.
- **Responses & Analytics**: Live viewer for prayer requests, connect cards, questions, poll votes, CSV export, and active attendee presence.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js 20+**
- A **[Cloudflare](https://dash.cloudflare.com)** account (for remote D1/R2 or local Wrangler simulation)

### 2. Clone and Install
```bash
git clone <your-repo-url> service-buttler
cd service-buttler
npm install
```

### 3. Apply D1 Schema Locally
```bash
npx wrangler d1 execute service-buttler-db --local --file=d1/schema.sql
```

### 4. Configure Environment
Copy `.env.example` to `.env` (and `.dev.vars` for local Wrangler secrets like `RESEND_API_KEY`):
```bash
cp .env.example .env
```

### 5. Start the Development Server
```bash
npm run dev
```
This starts Vite on [http://localhost:5173](http://localhost:5173) and Cloudflare Pages Functions (`wrangler pages dev`) on `:8788` with automatic `/api` proxying.

---

## 📦 Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md) for Cloudflare Pages, D1, R2, and Resend setup instructions.
