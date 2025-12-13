export function isModerator(
  moderatorId: string,
  currentPlayerId: string | undefined,
  isAllowMembersToManageSession: boolean | undefined,
) {
  if (isAllowMembersToManageSession) return true;
  return moderatorId === currentPlayerId;
}

