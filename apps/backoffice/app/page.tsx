import { VulpineCommandCenter } from "@/components/cards"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authConfigured, authOptions } from "@/lib/auth"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"
import { hasCapability } from "@vulpine/permissions"

export const dynamic = "force-dynamic"

export default async function Home() {
  if (!authConfigured()) {
    if(process.env.NODE_ENV === "production")return <main className="p-8"><h1>Authentication unavailable</h1><p>The workspace is locked until authentication is configured.</p></main>
    return <VulpineCommandCenter />
  }
  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/")
  if(!hasCapability(session.user.roles,"dashboard.read"))redirect("/access-denied")
  return <VulpineCommandCenter allowedSections={visibleSectionsForRoles(session.user.roles)} />
}
