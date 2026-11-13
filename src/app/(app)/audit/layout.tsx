import { requirePermission } from "@/server/auth/current-user";

/**
 * The permission check lives here, not only in the page, because the page sits
 * inside this segment's loading.tsx Suspense boundary: by the time it runs the
 * response has already started streaming with a 200, so its notFound() would
 * render the 404 screen under a 200 status. A layout renders outside its own
 * segment's boundary, so a refusal here is a real 404.
 */
export default async function AuditLayout({ children }: LayoutProps<"/audit">) {
  await requirePermission("audit:read");
  return children;
}
