import type { ReactNode } from "react";

// Landing e login: sem sidebar/topbar/bottom nav — era isso que ShellWrapper
// resolvia pela lista ROTAS_SEM_CHROME; agora quem decide é o route group.
export default function PublicoLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
