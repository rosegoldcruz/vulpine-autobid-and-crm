import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { VulpineCommandCenter } from "@/components/cards"
import { authConfigured, authOptions } from "@/lib/auth"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"
import { hasCapability } from "@vulpine/permissions"

export const metadata = { title: "Cabinet Brain | Vulpine Backoffice" }
export const dynamic = "force-dynamic"

export default async function VisionPage() {
  if (!authConfigured()) {
    if(process.env.NODE_ENV === "production")return <main className="p-8"><h1>Authentication unavailable</h1><p>The workspace is locked until authentication is configured.</p></main>
    return <VulpineCommandCenter initialSection="vision" />
  }
  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/bids/vision")
  if (!hasCapability(session.user.roles, "vision.read")) redirect("/")
  return <VulpineCommandCenter initialSection="vision" allowedSections={visibleSectionsForRoles(session.user.roles)} />
}
