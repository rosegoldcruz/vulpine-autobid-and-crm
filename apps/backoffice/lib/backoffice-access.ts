import { hasCapability } from "@vulpine/permissions"

export type BackofficeSectionId =
  | "dashboard"
  | "leads"
  | "contacts"
  | "companies"
  | "revenue"
  | "autobid"
  | "bidstracker"
  | "emailblaster"
  | "drive"
  | "settings"

export function visibleSectionsForRoles(roles: readonly string[]): BackofficeSectionId[] {
  const visible: BackofficeSectionId[] = []
  if (hasCapability(roles, "backoffice.access")) visible.push("dashboard")
  if (hasCapability(roles, "crm.read")) visible.push("leads", "contacts", "companies")
  if (hasCapability(roles, "finance.read")) visible.push("revenue")
  if (hasCapability(roles, "bids.read")) visible.push("autobid", "bidstracker")
  if (hasCapability(roles, "crm.write")) visible.push("emailblaster")
  if (hasCapability(roles, "drive.read")) visible.push("drive")
  if (hasCapability(roles, "settings.manage")) visible.push("settings")
  return visible
}
