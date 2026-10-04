import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import VulpineCommandCenter from "@/components/cards/vulpine-command-center"
import { authConfigured, authOptions } from "@/lib/auth"
import { visibleSectionsForRoles } from "@/lib/backoffice-access"
import { canAccessModule, moduleForPath } from "@/lib/platform-modules"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ modulePath: string[] }> }

export async function generateMetadata({ params }: Props) {
  const { modulePath } = await params
  const workspace = moduleForPath(`/${modulePath.join("/")}`)
  return { title: workspace ? `${workspace.label} | Vulpine Backoffice` : "Not found | Vulpine Backoffice" }
}

export default async function PlatformPage({ params }: Props) {
  const { modulePath } = await params
  const path = `/${modulePath.join("/")}`
  const workspace = moduleForPath(path)
  if (!workspace) notFound()

  // Match existing module preview behavior locally, but never open new
  // production routes when authentication configuration is missing.
  if (!authConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return <main className="p-8"><h1 className="text-2xl font-bold">Authentication unavailable</h1><p className="mt-3">This workspace is locked until authentication is configured.</p></main>
    }
    return <VulpineCommandCenter initialSection={workspace.id} />
  }

  const session = await getServerSession(authOptions)
  if (!session) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(path)}`)
  if (!canAccessModule(session.user.roles, workspace.id)) redirect("/access-denied")
  return <VulpineCommandCenter initialSection={workspace.id} allowedSections={visibleSectionsForRoles(session.user.roles)} />
}
