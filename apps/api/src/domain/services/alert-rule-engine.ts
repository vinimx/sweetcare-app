import type { AlertType, AlertSeverity, GuidanceKey } from "../entities/alert-event.entity.js";

export interface AlertRuleResult {
  alertType: AlertType;
  severityLevel: AlertSeverity;
  guidanceKey: GuidanceKey;
}

const HYPO_CODES = new Set(["hypoglycemia_mild", "tremor", "confusion"]);
const EMERGENCY_CODES = new Set(["loss_of_consciousness", "seizure"]);

// Pure, synchronous, deterministic — no I/O. Returns null when no rule matches.
// Rules are evaluated in priority order; first match wins.
export function evaluateAlertRules(
  symptomCodes: readonly string[],
  severityLevel: string,
): AlertRuleResult | null {
  // Rule 1 (highest priority): emergency symptom codes regardless of recorded severity
  if (symptomCodes.some((c) => EMERGENCY_CODES.has(c))) {
    return {
      alertType: "emergency_response_required",
      severityLevel: "emergency",
      guidanceKey: "HYPO_EMERGENCY_PROTOCOL",
    };
  }

  // Rule 2: severe hypoglycemia
  if (severityLevel === "severe" && symptomCodes.some((c) => HYPO_CODES.has(c))) {
    return {
      alertType: "severe_hypoglycemia",
      severityLevel: "critical",
      guidanceKey: "HYPO_SEVERE_PROTOCOL",
    };
  }

  // Rule 3: moderate hypoglycemia risk
  if (severityLevel === "moderate" && symptomCodes.some((c) => HYPO_CODES.has(c))) {
    return {
      alertType: "hypoglycemia_risk",
      severityLevel: "warning",
      guidanceKey: "HYPO_MILD_PROTOCOL",
    };
  }

  // Rules 4–5: ketoacidosis (emergency severity uses the emergency protocol)
  if (symptomCodes.includes("ketoacidosis_risk")) {
    if (severityLevel === "emergency" || severityLevel === "severe") {
      return {
        alertType: "ketoacidosis_risk",
        severityLevel: "critical",
        guidanceKey:
          severityLevel === "emergency" ? "KETO_EMERGENCY_PROTOCOL" : "KETO_RISK_PROTOCOL",
      };
    }
    if (severityLevel === "moderate") {
      return {
        alertType: "ketoacidosis_risk",
        severityLevel: "warning",
        guidanceKey: "KETO_RISK_PROTOCOL",
      };
    }
  }

  return null;
}
