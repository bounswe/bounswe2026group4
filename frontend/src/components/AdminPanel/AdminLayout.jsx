import { NavLink, Outlet } from "react-router-dom";
import { Flag, FileText, Users, Tag as TagIcon, Shield } from "lucide-react";

import { cn } from "@/lib/utils";

const sections = [
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/stories", label: "Stories", icon: FileText },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/tags", label: "Tags", icon: TagIcon },
];

function AdminLayout() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Admin Panel</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside aria-label="Admin sections">
          <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
            {sections.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <s.icon className="h-4 w-4" aria-hidden="true" />
                {s.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
