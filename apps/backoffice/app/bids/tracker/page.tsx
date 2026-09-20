import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { VulpineCommandCenter } from "@/components/cards"
import { authConfigured, authOptions } from "@/lib/auth"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"
import { hasCapability } from "@vulpine/permissions"

export const metadata = { title: "Bids Tracker | Vulpine Backoffice" }
export const dynamic = "force-dynamic"

export default async function BidsTrackerPage() {
  if (!authConfigured()) return <VulpineCommandCenter initialSection="bidstracker" />

  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/bids/tracker")
  if (!hasCapability(session.user.roles, "bids.read")) redirect("/")

  return (
    <VulpineCommandCenter
      initialSection="bidstracker"
      allowedSections={visibleSectionsForRoles(session.user.roles)}
    />
  )
}
