import { VulpineCommandCenter } from "@/components/cards"
import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import { authConfigured, authOptions } from "@/lib/auth"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"
import { hasCapability } from "@vulpine/permissions"

export default async function Home() {
  if (!authConfigured()) return <VulpineCommandCenter />
  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/")
  if (!hasCapability(session.user.roles, "dashboard.read")) notFound()
  return <VulpineCommandCenter allowedSections={visibleSectionsForRoles(session.user.roles)} />
}
