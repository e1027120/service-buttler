# Deployment Guide: Cloudflare Pages & Supabase

This step-by-step checklist guides you through setting up your production infrastructure for **Service Buttler**.

---

## Part 1: Supabase Setup (5 minutes)

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com) and create an organization & project.
   - Choose a region geographically close to your church.

2. **Run Migrations**:
   - In your project, click **SQL Editor** in the left sidebar.
   - Click **New query**.
   - Open [`supabase/all_in_one.sql`](./supabase/all_in_one.sql) in this repository, copy everything, paste into the SQL editor, and click **Run**.
   - *(Optional Demo Data)*: Run [`supabase/seed.sql`](./supabase/seed.sql) to populate the demo church `grace-community`.

3. **Get Your API Credentials**:
   - Go to **Project Settings** (gear icon) → **API**.
   - Copy:
     - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
     - **anon / public key** (e.g. `eyJhbGciOiJIUzI1NiIsInR...`)

4. **Auth URL Configuration**:
   - In Supabase, go to **Authentication** → **URL Configuration**.
   - Under **Site URL**, enter your Cloudflare Pages domain (e.g. `https://service-buttler.pages.dev` or custom domain).
   - Under **Redirect URLs**, add:
     - `http://localhost:5173/**` (for local dev)
     - `https://service-buttler.pages.dev/**` (for production)
     - `https://yourchurchdomain.com/**` (if using custom domain)

---

## Part 2: Cloudflare Setup (3 minutes)

1. **Get Cloudflare Account ID**:
   - In [dash.cloudflare.com](https://dash.cloudflare.com), your **Account ID** is shown in the right sidebar of the Overview page.

2. **Create Cloudflare API Token**:
   - Click your profile icon (top right) → **My Profile** → **API Tokens** → **Create Token**.
   - Choose the **Cloudflare Pages** template:
     - Permissions: `Account - Cloudflare Pages - Edit`, `Account - Account Settings - Read`.
   - Copy the generated token.

3. **Create the Pages Project in Cloudflare**:
   - Go to **Workers & Pages** → **Create application** → **Pages** → **Direct Upload**.
   - Name the project: `service-buttler`.

---

## Part 3: GitHub CI/CD Pipeline Setup (2 minutes)

1. **Push Code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: initial production commit"
   git branch -M main
   git remote add origin https://github.com/your-org/service-buttler.git
   git push -u origin main
   ```

2. **Configure GitHub Repository Secrets**:
   - In your GitHub repo, go to **Settings** → **Secrets and variables** → **Actions**.
   - Add these repository secrets:

| Secret Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The Cloudflare API token created in Part 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Your 32-character Cloudflare Account ID |
| `SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public API key |
| `PUBLIC_SITE_URL` | Your Pages URL, e.g. `https://service-buttler.pages.dev` |

3. **Verify Deployment**:
   - Go to the **Actions** tab in GitHub.
   - The **Deploy to Cloudflare Pages** workflow will run automatically.
   - Once complete, open `https://service-buttler.pages.dev` to see your live application.

---

## Part 4: Production Checklist for Sunday Morning

- [ ] Add your church at `/admin`.
- [ ] Configure your services and recurring Sunday times under **Services & times**.
- [ ] Add your action items (welcome announcement, sermon notes, live poll, giving options) under **Actions**.
- [ ] Brand your landing page with logo and colors under **Branding & landing**.
- [ ] Print the generated QR code under **QR & NFC** and test scanning with an iPhone and Android.
- [ ] Test the live cue switch on the AV tech's laptop by clicking **Push Live** and watching your phone instantly update.
