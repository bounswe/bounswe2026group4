import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, MapPin, LogOut, User, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

const publicLinks = [
  { to: "/map", label: "Map" },
  { to: "/", label: "Feed" },
];

const authLinks = [
  { to: "/submit", label: "Submit Story", icon: Plus },
];

function NavLink({ to, label, icon: Icon, pathname, onClick }) {
  const isActive = to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary",
        isActive ? "text-primary" : "text-muted-foreground",
      )}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {label}
    </Link>
  );
}

function AppLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleMobileLogout = () => {
    setSheetOpen(false);
    logout();
    navigate("/");
  };

  const links = isAuthenticated
    ? [...publicLinks, ...authLinks]
    : publicLinks;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-14 items-center px-4">
          {/* Logo */}
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span className="font-bold">StoryMap</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center space-x-6">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                label={link.label}
                icon={link.icon}
                pathname={location.pathname}
              />
            ))}
          </nav>

          <div className="ml-auto flex items-center space-x-2">
            {/* Desktop auth section */}
            <div className="hidden md:flex items-center space-x-2">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    <User className="h-4 w-4" aria-hidden="true" />
                    {user?.username}
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-1" />
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/login">Login</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/register">Register</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col space-y-4 mt-4">
                  {links.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      label={link.label}
                      icon={link.icon}
                      pathname={location.pathname}
                      onClick={() => setSheetOpen(false)}
                    />
                  ))}
                  <hr className="my-2" />
                  {isAuthenticated ? (
                    <>
                      <Link
                        to="/profile"
                        onClick={() => setSheetOpen(false)}
                        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                      >
                        <User className="h-4 w-4" aria-hidden="true" />
                        {user?.username}
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMobileLogout}
                        className="justify-start"
                      >
                        <LogOut className="h-4 w-4 mr-1" />
                        Logout
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="justify-start"
                      >
                        <Link to="/login" onClick={() => setSheetOpen(false)}>
                          Login
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        asChild
                        className="justify-start"
                      >
                        <Link
                          to="/register"
                          onClick={() => setSheetOpen(false)}
                        >
                          Register
                        </Link>
                      </Button>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
