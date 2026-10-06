# Service Buttler ⛪

A production-ready web application designed for live church services. Attendees scan a seat-back **QR code** or tap an **NFC tag** once to access a live, single-action landing page on their phones.

As the service progresses, their screens update automatically: **welcome announcements**, **sermon notes** (with interactive outline and personal note-taking), **live polls** (real-time voting and live charts), **offering options** (online giving links and copyable bank details), and **digital connect/prayer cards**.

Built for zero-downtime, global high performance:
- **Frontend & Admin**: React + TypeScript + Tailwind CSS (code-split, responsive mobile-first attendee view).
- **Edge Backend**: Cloudflare Pages & Workers (Edge-cached API with 15s cache to handle simultaneous congregation traffic spikes without hitting DB limits).
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS), atomic security-definer RPCs, Auth, and Storage.
- **Automated CI/CD**: GitHub Actions pipeline deploys on every git push to `main` with automatic secret synchronization to Cloudflare Pages.

---

## 📖 Architecture & Features

### 1. Attendee Single-Action Page (`/c/:churchSlug` or `/c/:churchSlug/:serviceSlug`)
- **Zero App Install**: Served instantly via browser on any modern iOS/Android device.
- **Time-based Action Resolution**: The page displays the specific configured action for the current minute of the service (e.g. `+10m` notes, `+45m` live poll, `+60m` offering).
- **AV Control Room Override (Live Pinning)**: If preaching runs long or schedule shifts, the AV/production team can "Push Live" any action with 1 click to force it immediately on attendee screens.
- **Live Polls**: Interactive voting with device fingerprinting (one vote per phone) and real-time aggregated results.
- **Interactive Sermon Notes**: Attendees can type private notes saved directly to their device's local storage and share/export them via native Web Share API or clipboard.
- **Offering & Giving**: Direct links to payment providers (Church Center, Pushpay, Subsplash, Stripe) and one-tap copyable bank/IBAN details.
- **Digital Connect / Prayer Cards**: Custom fields with honeypot spam protection.
- **Between Services / Idle State**: Automatically shows upcoming service countdown, church branding, custom links, and welcome messaging.
- **Edge Caching**: Cloudflare Workers caches the live page endpoint for 15s to absorb hundreds or thousands of simultaneous scans without overloading Supabase.

### 2. Multi-Tenant Admin Backend (`/admin`)
- **Multi-Church Membership**: A single account can belong to multiple churches with dedicated roles:
  - **Owner**: Full access, can delete the church and manage other owners.
  - **Admin**: Manage services, actions, team members, branding, and responses.
  - **Editor**: Manage services, actions, and push actions live.
- **Services & Times Manager**:
  - Multiple services per church (e.g. Sunday Morning, Sunday Evening, Youth Service).
  - Multiple times per service: recurring weekly (e.g. Every Sunday 10:00–11:30) or one-off specific dates (Christmas Eve, Easter).
  - Configurable live window: lead minutes before start (e.g. 15 min early) and trail minutes after end.
- **Action Timeline Builder**:
  - Time window offsets relative to service start time (e.g. `+15m` to `+45m`) or church-wide.
  - Priority scoring and manual ordering.
- **Branding & Landing Page Customizer**:
  - Primary & accent colors (live CSS variables injection into attendee screens).
  - Logo and hero banner uploads (Supabase Storage).
  - Themes: Light, Dark, or full Brand color background.
  - Custom footer links and welcome text.
  - Live side-by-side mobile iframe preview.
- **QR Code & NFC Tag Generator**:
  - High-resolution (1024×1024) PNG QR code generator, automatically tinted in the church's brand color, ready for bulletin/seat printing.
  - Step-by-step guide for writing to NFC stickers (NTAG213/215/216) using free phone apps.
- **Form Submissions & Responses**:
  - Live viewer for prayer requests and connect card submissions.
  - Archive/unarchive workflow.
  - One-click CSV export.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js 20+**
- A free **[Supabase](https://supabase.com)** account

### 2. Clone and Install
```bash
git clone <your-repo-url> service-buttler
cd service-buttler
npm install
```

### 3. Setup Database (Supabase)
1. In your Supabase dashboard, create a new project.
2. Go to **SQL Editor** in Supabase.
3. Open `supabase/all_in_one.sql` from this repository, paste the entire content into the SQL Editor, and click **Run**.
4. *(Optional Demo Data)*: Run `supabase/seed.sql` to populate the `grace-community` demo church with services, times, notes, live poll, and offering.

### 4. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Supabase credentials (found in **Supabase → Project Settings → API**):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_PUBLIC_SITE_URL=http://localhost:5173
```

### 5. Start the Development Server
```bash
npm run dev:web
```
- Open [http://localhost:5173](http://localhost:5173) to see the home page.
- Sign up at [http://localhost:5173/login](http://localhost:5173/login) to access `/admin`.
- If you ran `supabase/seed.sql`, visit [http://localhost:5173/c/grace-community](http://localhost:5173/c/grace-community) to preview the live attendee experience.

To test the Cloudflare Pages Functions locally alongside Vite:
```bash
npm run dev
```

---

## ☁️ Deployment on Cloudflare Pages & Workers

The project is structured natively for Cloudflare Pages:
- Static assets are built to `./dist`.
- Edge API functions live in `./functions/api/*` and run on Cloudflare Workers edge nodes.
- Route headers and security policies are configured in `public/_headers`.

### Option A: Automatic CI/CD Pipeline via GitHub Actions (Recommended)

Every push to `main` will build, typecheck, and deploy automatically to Cloudflare Pages.

1. **Create the Pages Project in Cloudflare**:
   - Log into Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages**.
   - Create a project named `service-buttler` (Direct Upload).

2. **Create a Cloudflare API Token**:
   - Go to Cloudflare Profile → **API Tokens** → **Create Token**.
   - Use the **Cloudflare Pages** template (Permissions: `Cloudflare Pages:Edit`, `Account:Read`).

3. **Set GitHub Repository Secrets**:
   Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token.
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID (found on the right sidebar of Cloudflare Dashboard).
   - `SUPABASE_URL`: `https://your-project-id.supabase.co`
   - `SUPABASE_ANON_KEY`: `eyJhbGciOi...`
   - `PUBLIC_SITE_URL`: `https://service-buttler.pages.dev` (or your custom domain).

4. **Push to Git**:
   ```bash
   git add .
   git commit -m "feat: initial commit"
   git push origin main
   ```
   The `.github/workflows/deploy.yml` workflow will automatically run:
   - Typechecks frontend and Cloudflare Worker code (`npm run typecheck`).
   - Builds the production bundle (`npm run build`).
   - Deploys static assets + Edge Functions via Wrangler.
   - Sets `SUPABASE_URL` and `SUPABASE_ANON_KEY` as production secrets in Cloudflare Pages.

---

### Option B: Manual CLI Deployment

You can deploy directly from your machine using Wrangler:

```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Build the project
npm run build

# 3. Deploy to Pages
npx wrangler pages deploy dist --project-name=service-buttler

# 4. Set production secrets for the Edge Functions
npx wrangler pages secret put SUPABASE_URL --project-name=service-buttler
npx wrangler pages secret put SUPABASE_ANON_KEY --project-name=service-buttler
```

---

## 🗄️ Database & Security (RLS)

All tables have **Row Level Security (RLS)** enabled:
- **`profiles`**: Users can only read their own profile or fellow church teammates.
- **`churches`**, **`services`**, **`service_times`**, **`actions`**: Readable and writable only by authenticated church members based on their role (`owner`, `admin`, `editor`).
- **Anonymous Attendees**: Never query Postgres tables directly. They only interact via strictly scoped, security-definer RPCs:
  - `get_live_page(p_church_slug, p_service_slug, p_at)`: Returns only public-safe fields for actions currently within their live time window.
  - `cast_vote(p_action, p_option, p_voter)`: Enforces that the poll is live and open before writing a vote.
  - `submit_response(p_action, p_payload)`: Whitelists only declared fields and enforces required constraints.
- **Storage (`church-assets`)**: Public read, upload restricted to members of the corresponding church ID folder.

---

## 📁 Repository Structure

```
├── .github/
│   └── workflows/
│       └── deploy.yml            # Automated CI/CD pipeline
├── functions/
│   ├── api/
│   │   ├── forms/[id]/submit.ts  # Edge form submission endpoint
│   │   ├── live/[[path]].ts      # Edge-cached live page endpoint
│   │   ├── polls/[id]/results.ts # Edge-cached live poll results
│   │   ├── polls/[id]/vote.ts    # Edge poll voting endpoint
│   │   └── health.ts             # Health check endpoint
│   └── tsconfig.json             # Worker typechecking config
├── public/
│   ├── _headers                  # Security & cache headers for Cloudflare
│   └── favicon.svg
├── server/
│   └── supabase.ts               # Worker-optimized Supabase fetch client
├── src/
│   ├── components/
│   │   ├── Markdown.tsx          # Sanitized markdown renderer
│   │   └── ui.tsx                # Accessible UI primitives & toasts
│   ├── lib/
│   │   ├── api.ts                # Attendee client (Worker + direct fallback)
│   │   ├── auth.tsx              # Supabase Auth provider & route guards
│   │   ├── supabase.ts           # Supabase client & storage uploader
│   │   ├── types.ts              # Domain TypeScript types
│   │   └── utils.ts              # Timezones, branding CSS vars, QR helpers
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── ActionEditors.tsx # Content form per action type
│   │   │   ├── Actions.tsx       # Live timeline & cue sheet
│   │   │   ├── AdminLayout.tsx   # Sidebar & church switcher
│   │   │   ├── Branding.tsx      # Theme & landing page customizer
│   │   │   ├── ChurchPicker.tsx  # Multi-church selection
│   │   │   ├── Dashboard.tsx     # Overview & live control room
│   │   │   ├── Responses.tsx     # Form submissions & CSV export
│   │   │   ├── Services.tsx      # Services & times manager
│   │   │   ├── Share.tsx         # QR code generator & NFC guide
│   │   │   └── Team.tsx          # Team members & invitations
│   │   ├── live/
│   │   │   ├── ActionView.tsx    # Attendee action renderers
│   │   │   └── LivePage.tsx      # Attendee single-action landing page
│   │   ├── Home.tsx              # Marketing landing
│   │   └── Login.tsx             # Auth page (Email/Password & Magic Link)
│   ├── App.tsx                   # Code-split routing
│   ├── index.css                 # Tailwind layers
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   │   ├── 20261006000000_schema.sql     # Tables, triggers, RLS
│   │   └── 20261006000100_public_api.sql # Security definer RPCs & storage
│   ├── all_in_one.sql            # Consolidated single-file migration
│   ├── seed.sql                  # Demo church data
│   └── config.toml               # Supabase CLI config
├── wrangler.toml                 # Cloudflare Pages configuration
├── package.json
└── vite.config.ts
```

---

## 📜 License

MIT. Built with care for congregations everywhere.
