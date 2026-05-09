import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

/**
 * Restricts a route to authenticated admin users.
 *  - Unauthenticated → redirect to /login.
 *  - Authenticated non-admin → render a simple "Not authorized" page.
 *  - Admin → render children.
 */
function AdminRoute({ children }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.role !== "admin") {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to access the admin panel.
        </p>
      </div>
    );
  }

  return children;
}

export default AdminRoute;
