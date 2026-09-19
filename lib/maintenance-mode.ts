export const MAINTENANCE_BYPASS_HEADER = "x-maintenance-bypass";

export function maintenanceModeEnabled(value = process.env.MAINTENANCE_MODE) {
  return ["1", "true", "on"].includes(String(value ?? "").trim().toLowerCase());
}

export function maintenanceBypassAllowed(
  receivedToken: string | null,
  configuredToken = process.env.MAINTENANCE_BYPASS_TOKEN,
) {
  const received = receivedToken?.trim() ?? "";
  const configured = configuredToken?.trim() ?? "";
  if (configured.length < 32 || received.length !== configured.length) return false;

  let difference = 0;
  for (let index = 0; index < configured.length; index += 1) {
    difference |= configured.charCodeAt(index) ^ received.charCodeAt(index);
  }
  return difference === 0;
}

export function maintenancePathIsPublic(pathname: string) {
  return (
    pathname === "/manutencao-sistema" ||
    pathname === "/api/health" ||
    pathname === "/api/auth/logout"
  );
}
