-- SweetCare — Enable CRUD for medical records
-- Apply on running DB after removing immutability constraints.
-- Run as a superuser: psql $DATABASE_URL -f apps/api/prisma/manual/enable-crud.sql

-- ─────────────────────────────────────────────────────
-- Drop immutability triggers for editable medical records
-- (audit_entries trigger is intentionally kept)
-- ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS insulin_records_immutable ON insulin_application_records;
DROP TRIGGER IF EXISTS symptom_records_immutable ON symptom_records;

-- ─────────────────────────────────────────────────────
-- Cascade FK: audit_entries → insulin/symptom/alert records
-- Allows deleting a medical record without orphaning audit rows
-- ─────────────────────────────────────────────────────
ALTER TABLE audit_entries DROP CONSTRAINT IF EXISTS audit_insulin_fk;
ALTER TABLE audit_entries DROP CONSTRAINT IF EXISTS audit_symptom_fk;
ALTER TABLE audit_entries DROP CONSTRAINT IF EXISTS audit_alert_fk;

ALTER TABLE audit_entries
  ADD CONSTRAINT audit_insulin_fk
  FOREIGN KEY (target_id) REFERENCES insulin_application_records(id) ON DELETE CASCADE;

ALTER TABLE audit_entries
  ADD CONSTRAINT audit_symptom_fk
  FOREIGN KEY (target_id) REFERENCES symptom_records(id) ON DELETE CASCADE;

ALTER TABLE audit_entries
  ADD CONSTRAINT audit_alert_fk
  FOREIGN KEY (target_id) REFERENCES alert_events(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────
-- Cascade FK: alert_events → symptom_records
-- Deleting a symptom record cascades to its alerts
-- ─────────────────────────────────────────────────────
ALTER TABLE alert_events DROP CONSTRAINT IF EXISTS alert_events_trigger_symptom_record_id_fkey;

ALTER TABLE alert_events
  ADD CONSTRAINT alert_events_trigger_symptom_record_id_fkey
  FOREIGN KEY (trigger_symptom_record_id) REFERENCES symptom_records(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────
-- RLS: allow UPDATE and DELETE for caregivers with patient access
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS insulin_record_update ON insulin_application_records;
DROP POLICY IF EXISTS insulin_record_delete ON insulin_application_records;

CREATE POLICY insulin_record_update ON insulin_application_records
  FOR UPDATE USING (has_patient_access(patient_profile_id));

CREATE POLICY insulin_record_delete ON insulin_application_records
  FOR DELETE USING (has_patient_access(patient_profile_id));

DROP POLICY IF EXISTS symptom_record_update ON symptom_records;
DROP POLICY IF EXISTS symptom_record_delete ON symptom_records;

CREATE POLICY symptom_record_update ON symptom_records
  FOR UPDATE USING (has_patient_access(patient_profile_id));

CREATE POLICY symptom_record_delete ON symptom_records
  FOR DELETE USING (has_patient_access(patient_profile_id));
