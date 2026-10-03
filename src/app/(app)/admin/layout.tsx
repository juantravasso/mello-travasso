import type { ReactNode } from "react";
import { exigirAdmin } from "@/lib/auth/dal";

// Barreira das páginas de administração: quem não é admin da plataforma
// recebe 404. As Server Actions de /admin também checam (exigirAdminAction).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await exigirAdmin();
  return <>{children}</>;
}
