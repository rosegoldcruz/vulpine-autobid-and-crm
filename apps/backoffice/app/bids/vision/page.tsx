import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { VulpineCommandCenter } from "@/components/cards"
import { authConfigured, authOptions } from "@/lib/auth"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"
import { hasCapability } from "@vulpine/permissions"

export const metadata = { title: "Vision | Vulpine Backoffice" }
export const dynamic = "force-dynamic"

export default async function VisionPage() {
  if (!authConfigured()) return <VulpineCommandCenter initialSection="vision" />
  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/bids/vision")
  if (!hasCapability(session.user.roles, "vision.read")) redirect("/")
  return <VulpineCommandCenter initialSection="vision" allowedSections={visibleSectionsForRoles(session.user.roles)} />
}
