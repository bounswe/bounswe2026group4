import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button";

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <MapPin className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-6xl font-bold tracking-tight text-foreground">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">Page not found</h2>
        <p className="text-muted-foreground max-w-sm">
          We couldn&apos;t find the page you were looking for. It may have been moved or
          doesn&apos;t exist.
        </p>
      </div>
      <Link to="/" className={buttonVariants()}>Back to home</Link>
    </div>
  );
}

export default NotFoundPage;
