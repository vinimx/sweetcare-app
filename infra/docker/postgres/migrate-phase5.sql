-- Phase 5 schema migration: InsightReport lifecycle fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('processing', 'completed', 'failed');
  END IF;
END $$;

ALTER TABLE insight_reports
  ADD COLUMN IF NOT EXISTS status report_status NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ALTER COLUMN summary_text     DROP NOT NULL,
  ALTER COLUMN pattern_findings DROP NOT NULL,
  ALTER COLUMN ai_model_version SET DEFAULT '',
  ALTER COLUMN disclaimer_key   SET DEFAULT 'CLINICAL_DISCLAIMER_V1';

CREATE INDEX IF NOT EXISTS insight_reports_status_idx ON insight_reports(status);
