import { PRODUCT_BRAND } from "@/lib/product-brand";

const ACTIVE_ORGANIZATION_KEY = `${PRODUCT_BRAND.localStoragePrefix}:active-organization`;

export function setActiveOrganizationId(organizationId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
}

export function getActiveOrganizationId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ORGANIZATION_KEY)?.trim() || null;
}

export function tenantStorageKey(key: string, organizationId = getActiveOrganizationId()) {
  if (!organizationId) return `${PRODUCT_BRAND.localStoragePrefix}:unscoped:${key}`;
  return `${PRODUCT_BRAND.localStoragePrefix}:${organizationId}:${key}`;
}
