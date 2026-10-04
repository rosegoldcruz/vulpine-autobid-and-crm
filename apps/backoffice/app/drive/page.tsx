import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import VulpineCommandCenter from "@/components/cards/vulpine-command-center"
import { authConfigured, authOptions } from "@/lib/auth"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"
import { hasCapability } from "@vulpine/permissions"

export const metadata = { title: "Vulpine Drive | Vulpine Backoffice" }
export const dynamic = "force-dynamic"

export default async function DrivePage() {
  if (!authConfigured()) {
    if(process.env.NODE_ENV === "production")return <main className="p-8"><h1>Authentication unavailable</h1><p>The workspace is locked until authentication is configured.</p></main>
    return <VulpineCommandCenter initialSection="drive" driveCanWrite />
  }

  const session = await getServerSession(authOptions)
  if (!session) redirect("/api/auth/signin?callbackUrl=/drive")
  if (!hasCapability(session.user.roles, "drive.read")) redirect("/")

  return (
    <VulpineCommandCenter
      initialSection="drive"
      allowedSections={visibleSectionsForRoles(session.user.roles)}
      driveCanWrite={hasCapability(session.user.roles, "drive.write")}
    />
  )
}
