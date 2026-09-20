import type {
  OrganizationSettings,
  OrganizationStatus,
} from "@/lib/types";

export type PlatformOrganization = {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string | null;
  document_number: string | null;
  status: OrganizationStatus;
  plan_code: string;
  user_limit: number;
  active_users: number;
  billing_email: string | null;
  contract_started_at: string | null;
  contract_ends_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  updated_at: string;
  settings: OrganizationSettings | null;
  integration: {
    provider: string;
    enabled: boolean;
    webhook_url: string;
    last_success_at: string | null;
    last_error: string | null;
  } | null;
};

export type PlatformAuditEntry = {
  id: string;
  actor_id: string | null;
  actor_name: string;
  organization_id: string | null;
  organization_name: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};
