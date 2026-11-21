import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Usage: SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." npx tsx scripts/migrate-from-supabase.ts

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ftkcxmpwcbrdsckopvnh.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('\n❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is required to export all tables and media from Supabase.');
  process.exit(1);
}

const isJwt = SERVICE_KEY.startsWith('eyJ');
function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY!, ...extra };
  if (isJwt) {
    h.Authorization = `Bearer ${SERVICE_KEY}`;
  }
  return h;
}

async function fetchAllTable(table: string, optional = false): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`, {
      headers: apiHeaders(),
    });
    if (!res.ok) {
      if (optional && res.status === 404) {
        console.log(`   ℹ️ Table "${table}" not present in Supabase (skipping).`);
        return [];
      }
      const txt = await res.text();
      throw new Error(`Failed to fetch table "${table}" (${res.status}): ${txt}`);
    }
    const rows = (await res.json()) as any[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function fetchAllUsers(): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: apiHeaders(),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Failed to list users (${res.status}): ${txt}`);
    }
    const data = (await res.json()) as { users?: any[] };
    const users = data.users || [];
    all.push(...users);
    if (users.length < perPage) break;
    page++;
  }
  return all;
}

async function listStorageFiles(bucket: string, prefix = ''): Promise<string[]> {
  const collected: string[] = [];
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) {
    console.warn(`   ⚠️ Could not list ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
    return collected;
  }
  const items = (await res.json()) as any[];
  for (const item of items) {
    if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id && !item.metadata) {
      const nested = await listStorageFiles(bucket, fullPath);
      collected.push(...nested);
    } else {
      collected.push(fullPath);
    }
  }
  return collected;
}

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function guessContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
  };
  return map[ext] || 'application/octet-stream';
}

async function migrate() {
  console.log(`\n🚀 Starting Migration from Supabase (${SUPABASE_URL}) to Cloudflare D1 & R2...\n`);

  // 1. Fetch Users
  console.log('1️⃣ Fetching Supabase auth users...');
  const users = await fetchAllUsers();
  console.log(`   Found ${users.length} users: ${users.map((u) => u.email).join(', ')}`);

  // 2. Fetch Tables
  console.log('2️⃣ Fetching database tables...');
  const [
    churches,
    members,
    invitations,
    services,
    serviceTimes,
    actions,
    pollVotes,
    responses,
    scans,
  ] = await Promise.all([
    fetchAllTable('churches'),
    fetchAllTable('church_members'),
    fetchAllTable('church_invitations'),
    fetchAllTable('services'),
    fetchAllTable('service_times'),
    fetchAllTable('actions'),
    fetchAllTable('poll_votes'),
    fetchAllTable('action_responses'),
    fetchAllTable('service_scans', true),
  ]);

  console.log(`   Churches: ${churches.length}`);
  console.log(`   Memberships: ${members.length}`);
  console.log(`   Invitations: ${invitations.length}`);
  console.log(`   Services: ${services.length}`);
  console.log(`   Service Times: ${serviceTimes.length}`);
  console.log(`   Actions: ${actions.length}`);
  console.log(`   Poll Votes: ${pollVotes.length}`);
  console.log(`   Action Responses: ${responses.length}`);
  console.log(`   Service Scans: ${scans.length}`);

  // 3. Migrate Storage Assets to Cloudflare R2
  console.log('\n3️⃣ Migrating media files from Supabase Storage bucket "church-assets" to Cloudflare R2...');
  const tmpDir = path.resolve('.tmp-migration-assets');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const urlMap = new Map<string, string>();
  const allAssetPaths = await listStorageFiles('church-assets', '');
  console.log(`   Found ${allAssetPaths.length} files in Supabase Storage "church-assets".`);

  for (const filePath of allAssetPaths) {
    console.log(`   📥 Downloading ${filePath}...`);
    const dlRes = await fetch(`${SUPABASE_URL}/storage/v1/object/church-assets/${filePath.split('/').map(encodeURIComponent).join('/')}`, {
      headers: apiHeaders(),
    });
    if (!dlRes.ok) {
      console.warn(`   ⚠️ Could not download ${filePath}: ${dlRes.status}`);
      continue;
    }

    const safeLocalName = filePath.replace(/\//g, '__');
    const localPath = path.join(tmpDir, safeLocalName);
    const arrayBuffer = await dlRes.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(arrayBuffer));

    const contentType = dlRes.headers.get('content-type') || guessContentType(filePath);

    console.log(`   📤 Uploading ${filePath} (${contentType}) to Cloudflare R2...`);
    try {
      execSync(
        `npx wrangler r2 object put "service-buttler-assets/${filePath}" --file="${localPath}" --content-type="${contentType}" --remote`,
        { stdio: 'pipe' }
      );
      const newUrl = `/api/assets/${filePath}`;
      const oldPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/church-assets/${filePath}`;
      urlMap.set(oldPublicUrl, newUrl);
      urlMap.set(encodeURI(oldPublicUrl), newUrl);
      console.log(`   ✅ Migrated ${filePath} -> ${newUrl}`);
    } catch (upErr: any) {
      console.error(`   ❌ Failed to upload ${filePath} to R2:`, upErr.message);
    }
  }

  function replaceUrls(obj: any): any {
    if (!obj) return obj;
    let str = JSON.stringify(obj);
    for (const [oldUrl, newUrl] of urlMap.entries()) {
      str = str.split(oldUrl).join(newUrl);
    }
    str = str.replace(
      /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/church-assets\/([^"'\s]+)/g,
      '/api/assets/$1'
    );
    return JSON.parse(str);
  }

  // 4. Generate SQL Statements
  console.log('\n4️⃣ Generating SQL insert batch for Cloudflare D1...');
  const sqlStatements: string[] = ['-- Auto-generated migration from Supabase'];

  const userIds = new Set(users.map((u) => u.id));
  const churchIdSet = new Set(churches.map((c) => c.id));
  const serviceIdSet = new Set(services.map((s) => s.id));
  const actionIdSet = new Set(actions.map((a) => a.id));

  for (const u of users) {
    const fullName = u.user_metadata?.full_name || u.user_metadata?.name || null;
    sqlStatements.push(
      `INSERT OR REPLACE INTO users (id, email, password_hash, full_name, created_at) VALUES (${escapeSql(u.id)}, ${escapeSql(u.email)}, NULL, ${escapeSql(fullName)}, ${escapeSql(u.created_at || new Date().toISOString())});`
    );
  }

  for (const c of churches) {
    const logoUrl = c.logo_url
      ? c.logo_url.replace(/https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/church-assets\/([^"'\s]+)/g, '/api/assets/$1')
      : null;
    const landing = replaceUrls(c.landing || {});
    const createdBy = c.created_by && userIds.has(c.created_by) ? c.created_by : null;

    sqlStatements.push(
      `INSERT OR REPLACE INTO churches (id, slug, name, timezone, logo_url, primary_color, accent_color, landing, created_by, created_at, updated_at) VALUES (${escapeSql(c.id)}, ${escapeSql(c.slug)}, ${escapeSql(c.name)}, ${escapeSql(c.timezone || 'UTC')}, ${escapeSql(logoUrl)}, ${escapeSql(c.primary_color || '#4f46e5')}, ${escapeSql(c.accent_color || '#f59e0b')}, ${escapeSql(landing)}, ${escapeSql(createdBy)}, ${escapeSql(c.created_at)}, ${escapeSql(c.updated_at || c.created_at)});`
    );
  }

  for (const m of members) {
    if (!churchIdSet.has(m.church_id) || !userIds.has(m.user_id)) continue;
    sqlStatements.push(
      `INSERT OR REPLACE INTO church_members (church_id, user_id, role, created_at) VALUES (${escapeSql(m.church_id)}, ${escapeSql(m.user_id)}, ${escapeSql(m.role || 'editor')}, ${escapeSql(m.created_at || new Date().toISOString())});`
    );
  }

  for (const inv of invitations) {
    if (!churchIdSet.has(inv.church_id)) continue;
    const invitedBy = inv.invited_by && userIds.has(inv.invited_by) ? inv.invited_by : null;
    sqlStatements.push(
      `INSERT OR REPLACE INTO church_invitations (id, church_id, email, role, invited_by, created_at) VALUES (${escapeSql(inv.id)}, ${escapeSql(inv.church_id)}, ${escapeSql(inv.email)}, ${escapeSql(inv.role || 'editor')}, ${escapeSql(invitedBy)}, ${escapeSql(inv.created_at || new Date().toISOString())});`
    );
  }

  for (const s of services) {
    if (!churchIdSet.has(s.church_id)) continue;
    sqlStatements.push(
      `INSERT OR REPLACE INTO services (id, church_id, name, slug, description, lead_minutes, trail_minutes, live_action_id, live_action_until, is_active, sort_order, created_at, updated_at) VALUES (${escapeSql(s.id)}, ${escapeSql(s.church_id)}, ${escapeSql(s.name)}, ${escapeSql(s.slug)}, ${escapeSql(s.description)}, ${escapeSql(s.lead_minutes ?? 15)}, ${escapeSql(s.trail_minutes ?? 30)}, ${escapeSql(s.live_action_id)}, ${escapeSql(s.live_action_until)}, ${s.is_active ? 1 : 0}, ${escapeSql(s.sort_order ?? 0)}, ${escapeSql(s.created_at)}, ${escapeSql(s.updated_at || s.created_at)});`
    );
  }

  for (const st of serviceTimes) {
    if (!serviceIdSet.has(st.service_id)) continue;
    sqlStatements.push(
      `INSERT OR REPLACE INTO service_times (id, service_id, day_of_week, specific_date, start_time, end_time, label, is_active, created_at) VALUES (${escapeSql(st.id)}, ${escapeSql(st.service_id)}, ${escapeSql(st.day_of_week)}, ${escapeSql(st.specific_date)}, ${escapeSql(st.start_time)}, ${escapeSql(st.end_time)}, ${escapeSql(st.label)}, ${st.is_active ? 1 : 0}, ${escapeSql(st.created_at || new Date().toISOString())});`
    );
  }

  for (const a of actions) {
    if (!churchIdSet.has(a.church_id)) continue;
    const serviceId = a.service_id && serviceIdSet.has(a.service_id) ? a.service_id : null;
    const content = replaceUrls(a.content || {});
    sqlStatements.push(
      `INSERT OR REPLACE INTO actions (id, church_id, service_id, type, title, content, start_offset_minutes, end_offset_minutes, priority, is_active, sort_order, created_at, updated_at) VALUES (${escapeSql(a.id)}, ${escapeSql(a.church_id)}, ${escapeSql(serviceId)}, ${escapeSql(a.type)}, ${escapeSql(a.title)}, ${escapeSql(content)}, ${escapeSql(a.start_offset_minutes)}, ${escapeSql(a.end_offset_minutes)}, ${escapeSql(a.priority ?? 0)}, ${a.is_active ? 1 : 0}, ${escapeSql(a.sort_order ?? 0)}, ${escapeSql(a.created_at)}, ${escapeSql(a.updated_at || a.created_at)});`
    );
  }

  for (const pv of pollVotes) {
    if (!actionIdSet.has(pv.action_id)) continue;
    sqlStatements.push(
      `INSERT OR REPLACE INTO poll_votes (action_id, voter_token, option_id, created_at) VALUES (${escapeSql(pv.action_id)}, ${escapeSql(pv.voter_token)}, ${escapeSql(pv.option_id)}, ${escapeSql(pv.created_at || new Date().toISOString())});`
    );
  }

  for (const r of responses) {
    if (!actionIdSet.has(r.action_id) || !churchIdSet.has(r.church_id)) continue;
    const payload = typeof r.payload === 'object' ? r.payload : JSON.parse(r.payload || '{}');
    sqlStatements.push(
      `INSERT OR REPLACE INTO action_responses (id, action_id, church_id, payload, is_archived, created_at) VALUES (${escapeSql(r.id)}, ${escapeSql(r.action_id)}, ${escapeSql(r.church_id)}, ${escapeSql(payload)}, ${r.is_archived ? 1 : 0}, ${escapeSql(r.created_at || new Date().toISOString())});`
    );
  }

  for (const sc of scans) {
    if (!churchIdSet.has(sc.church_id)) continue;
    const serviceId = sc.service_id && serviceIdSet.has(sc.service_id) ? sc.service_id : null;
    sqlStatements.push(
      `INSERT OR REPLACE INTO service_scans (id, church_id, service_id, source, scanned_at) VALUES (${escapeSql(sc.id)}, ${escapeSql(sc.church_id)}, ${escapeSql(serviceId)}, ${escapeSql(sc.source || 'qr')}, ${escapeSql(sc.scanned_at || new Date().toISOString())});`
    );
  }

  const sqlFile = path.resolve('d1/data_migration.sql');
  fs.writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf-8');
  console.log(`   💾 Wrote ${sqlStatements.length - 1} statements to ${sqlFile}`);

  // 5. Apply SQL to Cloudflare D1
  console.log('\n5️⃣ Executing migration on Cloudflare D1 (service-buttler-db)...');
  execSync(`npx wrangler d1 execute service-buttler-db --remote --yes --file="${sqlFile}"`, {
    stdio: 'inherit',
  });

  // Cleanup tmp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('\n✨ MIGRATION COMPLETE! All data and assets have been transferred to Cloudflare D1 and R2.\n');
}

migrate().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
