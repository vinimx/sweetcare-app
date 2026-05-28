-- PostgreSQL initialization script for SweetCare dev environment
-- Runs once on first container start

-- Enable extensions required by the application
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- column-level encryption
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID generation fallback
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy text search (future)

-- Phase 2: RLS policies and audit trigger will be added via Prisma migrations
