export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type AlertStatus = "active" | "updated" | "removed";
export type AlertCategory =
  | "missing_person"
  | "wanted_suspect"
  | "public_appeal"
  | "cyber_advisory"
  | "terrorism_tip"
  | "fraud_alert"
  | "public_safety";
export type AuthorityType =
  | "police"
  | "national_security"
  | "intelligence"
  | "regulatory"
  | "public_safety_program"
  | "cert";

export interface AuthoritySource {
  source_id: string;
  authority_name: string;
  country: string;
  country_code: string;
  region: string;
  authority_type: AuthorityType;
  base_url: string;
}

export interface Alert {
  alert_id: string;
  source_id: string;
  source: AuthoritySource;
  title: string;
  canonical_url: string;
  first_seen: string;
  last_seen: string;
  status: AlertStatus;
  category: AlertCategory;
  severity: Severity;
  region_tag: string;
  lat: number;
  lng: number;
  freshness_hours: number;
  reporting?: ReportingInfo;
}

export interface ReportingInfo {
  label: string;
  url?: string;
  phone?: string;
  email?: string;
  notes?: string;
}
