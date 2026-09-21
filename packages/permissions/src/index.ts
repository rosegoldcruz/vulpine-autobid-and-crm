export const roles = ["admin", "executive", "finance", "operations", "estimator", "sales", "nbc"] as const
export type VulpineRole = (typeof roles)[number]

export const capabilities = [
  "backoffice.access",
  "bids.read",
  "bids.write",
  "bids.upload",
  "bids.delete",
  "vision.read",
  "vision.write",
  "crm.read",
  "crm.write",
  "drive.read",
  "drive.write",
  "finance.read",
  "finance.write",
  "settings.manage",
] as const

export type Capability = (typeof capabilities)[number]

const roleCapabilities: Record<VulpineRole, readonly Capability[] | "*"> = {
  admin: "*",
  executive: ["backoffice.access", "bids.read", "vision.read", "crm.read", "drive.read", "finance.read"],
  finance: ["backoffice.access", "bids.read", "crm.read", "drive.read", "finance.read", "finance.write"],
  operations: ["backoffice.access", "bids.read", "bids.write", "bids.upload", "vision.read", "crm.read", "drive.read", "drive.write"],
  estimator: ["backoffice.access", "bids.read", "bids.write", "bids.upload", "vision.read", "vision.write", "drive.read"],
  sales: ["backoffice.access", "bids.read", "crm.read", "crm.write", "drive.read"],
  nbc: ["backoffice.access", "bids.read", "bids.write", "bids.upload", "vision.read", "crm.read", "drive.read"],
}

export function isVulpineRole(value: string): value is VulpineRole {
  return (roles as readonly string[]).includes(value)
}

export function capabilitiesForRoles(inputRoles: readonly string[]): Capability[] {
  const result = new Set<Capability>()
  for (const role of inputRoles) {
    if (!isVulpineRole(role)) continue
    const grants = roleCapabilities[role]
    if (grants === "*") return [...capabilities]
    grants.forEach((grant) => result.add(grant))
  }
  return [...result]
}

export function hasCapability(inputRoles: readonly string[], capability: Capability): boolean {
  return capabilitiesForRoles(inputRoles).includes(capability)
}
