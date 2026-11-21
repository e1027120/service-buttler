# Deployment Guide — Cloudflare Pages, D1 & R2

Service Buttler runs natively on **Cloudflare Pages** with **Pages Functions**, **Cloudflare D1** (SQLite database), and **Cloudflare R2** (media storage).

---

## 1. Provision Cloudflare Resources

1. **Create D1 database**:
   ```bash
   npx wrangler d1 create service-buttler-db
   ```
   Copy the returned `database_id` into `wrangler.toml`.

2. **Apply database schema**:
   ```bash
   npx wrangler d1 execute service-buttler-db --remote --file=d1/schema.sql
   ```

3. **Create R2 bucket**:
   ```bash
   npx wrangler r2 bucket create service-buttler-assets
   ```

---

## 2. Configure Cloudflare Pages

1. Connect the GitHub repository to a Cloudflare Pages project (`service-buttler`):
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
2. Bindings are declared in `wrangler.toml` (`DB` → `service-buttler-db`, `ASSETS_BUCKET` → `service-buttler-assets`, `compatibility_flags = ["nodejs_compat"]`).
3. Add email secrets in **Cloudflare Pages → Settings → Environment variables** (Production):
   - `RESEND_API_KEY`: Your Resend API key (used for Magic Links & team invitations)
   - `RESEND_FROM_EMAIL`: Sender address, e.g. `Service Buttler <noreply@service-buttler.com>`

---

## 3. Deploy

Push to `main` to trigger an automated Cloudflare Pages build & deployment, or deploy manually with:
```bash
npm run deploy
```

### Smoke-Test Endpoints
- `GET /api/health` → `{ "ok": true, "provider": "cloudflare", "d1Configured": true, "r2Configured": true }`
- `GET /api/config` → `{ "provider": "cloudflare", "db": "d1", "storage": "r2" }`
- `GET /api/live/<churchSlug>` → Live attendee JSON payload
