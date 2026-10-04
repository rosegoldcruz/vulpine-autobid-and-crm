import { visiblePlatformModules, type PlatformModuleId } from "./platform-modules"

export type BackofficeSectionId = PlatformModuleId

export function visibleSectionsForRoles(roles: readonly string[]): BackofficeSectionId[] {
  // Preserve legacy section ordering for existing consumers while extending
  // visibility from the same registry used for direct-route authorization.
  const legacyOrder: PlatformModuleId[] = ["dashboard", "leads", "contacts", "companies", "phone", "revenue", "autobid", "bidstracker", "vision", "emailblaster", "drive", "settings"]
  const visible = visiblePlatformModules(roles)
  return [...legacyOrder.filter((id) => visible.includes(id)), ...visible.filter((id) => !legacyOrder.includes(id))]
}
