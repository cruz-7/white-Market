import { Link, useNavigate } from "react-router-dom";
import { Button } from "./button";
import { Menu, X, LogOut, LayoutDashboard, MessageSquare, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

type LocalUser = {
  id: string;
  full_name: string;
  avatar_url?: string;
  role?: "user" | "seller" | "admin";
};

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const syncLocalUser = () => {
      const raw = localStorage.getItem("wm_user");
      if (!raw) {
        setUser(null);
        setIsAdmin(false);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as LocalUser;
        setUser(parsed);
        setIsAdmin(parsed.role === "admin");
      } catch {
        localStorage.removeItem("wm_user");
        setUser(null);
        setIsAdmin(false);
      }
    };

    syncLocalUser();
    window.addEventListener("storage", syncLocalUser);
    window.addEventListener("wm-auth-change", syncLocalUser);
    return () => {
      window.removeEventListener("storage", syncLocalUser);
      window.removeEventListener("wm-auth-change", syncLocalUser);
    };
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("wm_user");
    setUser(null);
    setIsAdmin(false);
    navigate("/");
  };

  const initials = user?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";

  return (
    <nav className="sticky top-0 z-50 border-b border-border/70 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <span className="font-display text-lg font-bold text-primary-foreground">WM</span>
          </div>
          <span className="font-display text-xl font-bold text-foreground">White Market</span>
        </Link>

        <div className="hidden items-center gap-5 md:flex">
          <Link to="/marketplace" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Marketplace</Link>

          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
              <Link to="/orders" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Orders</Link>
              <Link to="/messages" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Messages</Link>
              {isAdmin && (
                <Link to="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-white p-1 pr-3 shadow-sm hover:bg-muted/50 transition-colors">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.avatar_url} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user?.full_name?.split(" ")[0] || "Account"}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/profile-setup")}>
                    <MessageSquare className="h-4 w-4 mr-2" /> Edit Profile
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <ShieldCheck className="h-4 w-4 mr-2" /> Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
            <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Login</Link>
              <Button asChild size="sm">
                <Link to="/auth?tab=signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <button className="rounded-lg border border-transparent p-1 md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-white p-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link to="/marketplace" className="text-sm font-medium" onClick={() => setOpen(false)}>Marketplace</Link>
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium" onClick={() => setOpen(false)}>Dashboard</Link>
                <Link to="/orders" className="text-sm font-medium" onClick={() => setOpen(false)}>Orders</Link>
                <Link to="/messages" className="text-sm font-medium" onClick={() => setOpen(false)}>Messages</Link>
                {isAdmin && (
                  <Link to="/admin" className="text-sm font-medium flex items-center gap-1" onClick={() => setOpen(false)}>
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin Panel
                  </Link>
                )}
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => { handleSignOut(); setOpen(false); }}>
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-medium" onClick={() => setOpen(false)}>Login</Link>
                <Button asChild size="sm" className="w-full">
                  <Link to="/auth?tab=signup" onClick={() => setOpen(false)}>Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
