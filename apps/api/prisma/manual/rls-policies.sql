-- SweetCare — Row Level Security Policies
-- Apply after initial Prisma migration: prisma migrate deploy
-- Run as a superuser or the migration user (not the app user)
--
-- These policies enforce multi-tenant data isolation at the DB layer.
-- The app sets `app.current_user_id` via SET LOCAL on each request.

-- ─────────────────────────────────────────────────────
-- Helper: check if current user has active caregiver access to a patient
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_patient_access(p_patient_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM caregiver_assignments
    WHERE patient_profile_id = p_patient_profile_id
      AND user_id = current_setting('app.current_user_id', true)::uuid
      AND revoked_at IS NULL
  );
$$;

-- ─────────────────────────────────────────────────────
-- Enable RLS on all PHI-bearing tables
-- ─────────────────────────────────────────────────────
ALTER TABLE patient_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE insulin_application_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptom_records               ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records               ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_assignments         ENABLE ROW LEVEL SECURITY;

-- Audit entries: always enabled, insert-only (no SELECT policy for app user)
ALTER TABLE audit_entries ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────
-- PatientProfile — read/write only if assigned caregiver
-- ─────────────────────────────────────────────────────
CREATE POLICY patient_profile_access ON patient_profiles
  USING (has_patient_access(id));

CREATE POLICY patient_profile_create ON patient_profiles
  FOR INSERT WITH CHECK (
    created_by_user_id = current_setting('app.current_user_id', true)::uuid
  );

-- ─────────────────────────────────────────────────────
-- InsulinApplicationRecord — same caregiver access
-- ─────────────────────────────────────────────────────
CREATE POLICY insulin_record_access ON insulin_application_records
  USING (has_patient_access(patient_profile_id));

CREATE POLICY insulin_record_insert ON insulin_application_records
  FOR INSERT WITH CHECK (has_patient_access(patient_profile_id));

CREATE POLICY insulin_record_update ON insulin_application_records
  FOR UPDATE USING (has_patient_access(patient_profile_id));

CREATE POLICY insulin_record_delete ON insulin_application_records
  FOR DELETE USING (has_patient_access(patient_profile_id));

-- ─────────────────────────────────────────────────────
-- SymptomRecord
-- ─────────────────────────────────────────────────────
CREATE POLICY symptom_record_access ON symptom_records
  USING (has_patient_access(patient_profile_id));

CREATE POLICY symptom_record_insert ON symptom_records
  FOR INSERT WITH CHECK (has_patient_access(patient_profile_id));

CREATE POLICY symptom_record_update ON symptom_records
  FOR UPDATE USING (has_patient_access(patient_profile_id));

CREATE POLICY symptom_record_delete ON symptom_records
  FOR DELETE USING (has_patient_access(patient_profile_id));

-- ─────────────────────────────────────────────────────
-- AlertEvent
-- ─────────────────────────────────────────────────────
CREATE POLICY alert_event_access ON alert_events
  USING (has_patient_access(patient_profile_id));

-- Alerts may be resolved (UPDATE resolvedAt) but not deleted
CREATE POLICY alert_event_resolve ON alert_events
  FOR UPDATE USING (has_patient_access(patient_profile_id));

-- ─────────────────────────────────────────────────────
-- SyncEvent
-- ─────────────────────────────────────────────────────
CREATE POLICY sync_event_access ON sync_events
  USING (has_patient_access(patient_profile_id));

CREATE POLICY sync_event_insert ON sync_events
  FOR INSERT WITH CHECK (has_patient_access(patient_profile_id));

-- ─────────────────────────────────────────────────────
-- InsightReport
-- ─────────────────────────────────────────────────────
CREATE POLICY insight_report_access ON insight_reports
  USING (has_patient_access(patient_profile_id));

CREATE POLICY insight_report_insert ON insight_reports
  FOR INSERT WITH CHECK (has_patient_access(patient_profile_id));

-- ─────────────────────────────────────────────────────
-- ConsentRecord — only the guardian who granted it
-- ─────────────────────────────────────────────────────
CREATE POLICY consent_record_access ON consent_records
  USING (guardian_user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY consent_record_insert ON consent_records
  FOR INSERT WITH CHECK (
    guardian_user_id = current_setting('app.current_user_id', true)::uuid
  );

-- ─────────────────────────────────────────────────────
-- AuditEntry — INSERT ONLY for app role; no SELECT/UPDATE/DELETE
-- (Audit reads are done by admin role with RLS bypassed via SET ROLE)
-- ─────────────────────────────────────────────────────
CREATE POLICY audit_insert_only ON audit_entries
  FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────
-- Immutable-record enforcement trigger
-- Only audit_entries remain immutable (insulin/symptom records support full CRUD)
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_medical_record_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit entries are immutable'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER audit_entries_immutable
  BEFORE UPDATE OR DELETE ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_medical_record_mutation();

-- ─────────────────────────────────────────────────────
-- Cascade FK constraints for clean deletes
-- ─────────────────────────────────────────────────────
ALTER TABLE audit_entries
  ADD CONSTRAINT audit_insulin_fk
  FOREIGN KEY (target_id) REFERENCES insulin_application_records(id) ON DELETE CASCADE;

ALTER TABLE audit_entries
  ADD CONSTRAINT audit_symptom_fk
  FOREIGN KEY (target_id) REFERENCES symptom_records(id) ON DELETE CASCADE;

ALTER TABLE audit_entries
  ADD CONSTRAINT audit_alert_fk
  FOREIGN KEY (target_id) REFERENCES alert_events(id) ON DELETE CASCADE;

ALTER TABLE alert_events
  ADD CONSTRAINT alert_events_trigger_symptom_record_id_fkey
  FOREIGN KEY (trigger_symptom_record_id) REFERENCES symptom_records(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────
-- updated_at auto-update trigger (for tables that need it)
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER patient_profiles_updated_at
  BEFORE UPDATE ON patient_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
