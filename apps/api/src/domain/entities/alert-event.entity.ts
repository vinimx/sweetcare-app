export type AlertType =
  | "hypoglycemia_risk"
  | "severe_hypoglycemia"
  | "ketoacidosis_risk"
  | "emergency_response_required";

export type AlertSeverity = "warning" | "critical" | "emergency";

export type GuidanceKey =
  | "HYPO_MILD_PROTOCOL"
  | "HYPO_SEVERE_PROTOCOL"
  | "HYPO_EMERGENCY_PROTOCOL"
  | "KETO_RISK_PROTOCOL"
  | "KETO_EMERGENCY_PROTOCOL";

export interface AlertGuidance {
  title: string;
  immediate_steps: string[];
  emergency_contacts: { label: string; phone: string }[];
  seek_emergency_care: boolean;
  disclaimer: string;
}

const DISCLAIMER = "Este guia não substitui orientação médica profissional.";

const EMERGENCY_CONTACTS = [
  { label: "SAMU", phone: "+55192" },
  { label: "Bombeiros", phone: "+55193" },
];

export const ALERT_GUIDANCE: Record<GuidanceKey, AlertGuidance> = {
  HYPO_MILD_PROTOCOL: {
    title: "Hipoglicemia Leve",
    immediate_steps: [
      "Ofereça 15g de carboidrato de ação rápida (suco de laranja, glicose em gel)",
      "Aguarde 15 minutos e reavalie a glicemia",
      "Repita se a glicemia permanecer abaixo de 70 mg/dL",
      "Registre o episódio no aplicativo após a estabilização",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: false,
    disclaimer: DISCLAIMER,
  },
  HYPO_SEVERE_PROTOCOL: {
    title: "Hipoglicemia Grave",
    immediate_steps: [
      "Administre glucagon conforme prescrição médica",
      "Se inconsciente, posicione deitado de lado (posição de recuperação)",
      "Não ofereça nada por via oral se inconsciente",
      "Monitore continuamente até a recuperação da consciência",
      "Contate o médico responsável imediatamente após a estabilização",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: false,
    disclaimer: DISCLAIMER,
  },
  HYPO_EMERGENCY_PROTOCOL: {
    title: "Emergência — Perda de Consciência",
    immediate_steps: [
      "Ligue imediatamente para o SAMU: 192",
      "Posicione a criança deitada de lado",
      "Não ofereça nada por via oral",
      "Monitore a respiração até a chegada do socorro",
      "Informe ao SAMU que a criança é diabética tipo 1",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: true,
    disclaimer: DISCLAIMER,
  },
  KETO_RISK_PROTOCOL: {
    title: "Risco de Cetoacidose",
    immediate_steps: [
      "Incentive hidratação com água",
      "Meça cetonas na urina ou no sangue imediatamente",
      "Contate o médico se cetonas elevadas (> 1,5 mmol/L)",
      "Monitore a glicemia a cada hora",
      "Não administre insulina adicional sem orientação médica",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: false,
    disclaimer: DISCLAIMER,
  },
  KETO_EMERGENCY_PROTOCOL: {
    title: "Emergência — Cetoacidose Suspeita",
    immediate_steps: [
      "Ligue imediatamente para o SAMU: 192",
      "Não administre insulina sem orientação médica",
      "Hidrate apenas se a criança estiver consciente e conseguir engolir",
      "Monitore os sinais vitais até a chegada do socorro",
      "Informe ao SAMU que a criança é diabética tipo 1",
    ],
    emergency_contacts: EMERGENCY_CONTACTS,
    seek_emergency_care: true,
    disclaimer: DISCLAIMER,
  },
};

export const GUIDANCE_SUMMARY: Record<GuidanceKey, string> = {
  HYPO_MILD_PROTOCOL: "Aplique a regra 15-15 para hipoglicemia leve",
  HYPO_SEVERE_PROTOCOL: "Hipoglicemia grave — administre glucagon e monitore",
  HYPO_EMERGENCY_PROTOCOL: "Emergência: perda de consciência — ligue 192 imediatamente",
  KETO_RISK_PROTOCOL: "Risco de cetoacidose — hidrate e monitore cetonas",
  KETO_EMERGENCY_PROTOCOL: "Emergência: cetoacidose suspeita — ligue 192 imediatamente",
};
