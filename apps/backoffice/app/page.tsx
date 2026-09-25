import { VulpineCommandCenter } from "@/components/cards"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authConfigured, authOptions } from "@/lib/auth"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"

export default async function Home() {
  if (!authConfigured()) return <VulpineCommandCenter />
  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/")
  return <VulpineCommandCenter allowedSections={visibleSectionsForRoles(session.user.roles)} />
}
