-- =============================================================================
-- SERVICE BUTTLER — FULL DATABASE SCHEMA & PUBLIC API
-- Paste this entire file into Supabase → SQL Editor and click Run.
-- =============================================================================

-- 1. Core schema, tables and RLS
\ir migrations/20261006000000_schema.sql

-- 2. Public RPCs (live page, voting, form submissions, team management)
\ir migrations/20261006000100_public_api.sql
