export function normalizeOfflineOwnerId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function offlineOwnerMatchesSession(ownerUserId: unknown, sessionUserId: string) {
  const owner = normalizeOfflineOwnerId(ownerUserId);
  const session = normalizeOfflineOwnerId(sessionUserId);
  return owner !== null && session !== null && owner === session;
}

export function offlineOwnerValidationError(
  ownerUserId: unknown,
  sessionUserId: string,
) {
  const owner = normalizeOfflineOwnerId(ownerUserId);
  if (!owner) return null;
  return offlineOwnerMatchesSession(owner, sessionUserId)
    ? null
    : "Este lançamento offline pertence a outro usuário.";
}
