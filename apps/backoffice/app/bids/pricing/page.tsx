import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { hasCapability } from "@vulpine/permissions"
import { authConfigured, authOptions } from "@/lib/auth"
import VulpineCommandCenter from "@/components/cards/vulpine-command-center"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"

export const dynamic = "force-dynamic"
export const metadata = { title: "Cabinet pricing | Vulpine Backoffice" }

export default async function PricingPage() {
  if (!authConfigured()) return <main className="p-8">Cabinet pricing is locked until authentication is configured.</main>
  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/bids/pricing")
  if (!hasCapability(session.user.roles, "bids.read")) redirect("/access-denied")
  return <VulpineCommandCenter initialSection="pricing" allowedSections={visibleSectionsForRoles(session.user.roles)} />
}
