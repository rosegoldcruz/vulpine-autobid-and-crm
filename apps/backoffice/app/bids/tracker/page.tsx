import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { BidsTrackerSection } from "@/components/cards/bids-tracker-section"
import { authConfigured, authOptions } from "@/lib/auth"
import { hasCapability } from "@vulpine/permissions"

export const metadata = { title: "Bids Tracker | Vulpine Backoffice" }
export const dynamic = "force-dynamic"

export default async function BidsTrackerPage() {
  if (!authConfigured()) return <BidsTrackerSection />

  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/bids/tracker")
  if (!hasCapability(session.user.roles, "bids.read")) redirect("/")

  return <BidsTrackerSection />
}
