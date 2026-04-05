import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "./button";
import { Menu, X, LogOut, LayoutDashboard, MessageSquare, ShieldCheck, Heart, Bell, Gift, Package, Settings, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { supabase } from "./supabase-client";
import { useSettings } from "./SettingsContext";
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
  const location = useLocation();
  const { isDarkMode, setTheme, translations } = useSettings();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const linkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      isActive(path)
        ? "text-primary dark:text-primary-foreground font-semibold"
        : "text-muted-foreground hover:text-foreground dark:text-slate-300 dark:hover:text-white"
    }`;

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

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    localStorage.removeItem("wm_user");
    setUser(null);
    setIsAdmin(false);
    navigate("/");
  };

  const toggleTheme = () => {
    setTheme(isDarkMode ? "light" : "dark");
  };

  const initials = user?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";

  return (
    <nav className="sticky top-0 z-50 border-b border-border/70 bg-white/90 shadow-sm backdrop-blur-md dark:bg-slate-900/90 dark:border-slate-700">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="White Market logo" className="h-9 w-9 rounded-xl shadow-sm" />
          <span className="font-display text-xl font-bold text-foreground dark:text-white">White Market</span>
        </Link>

        <div className="hidden items-center gap-5 md:flex">
          <Link to="/marketplace" className={linkClass("/marketplace")}>Marketplace</Link>
          <Link to="/categories" className={linkClass("/categories") + " flex items-center gap-1"}>
            <Package className="h-4 w-4" /> Categories
          </Link>

          {user ? (
            <>
              <Link to="/dashboard" className={linkClass("/dashboard")}>Dashboard</Link>
              <Link to="/orders" className={linkClass("/orders")}>Orders</Link>
              <Link to="/messages" className={linkClass("/messages")}>Messages</Link>
              {isAdmin && (
                <Link to="/admin" className={linkClass("/admin") + " flex items-center gap-1"}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-white p-1 pr-3 shadow-sm hover:bg-muted/50 transition-colors dark:bg-slate-800 dark:border-slate-600">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.avatar_url} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">${initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium dark:text-white">${user?.full_name?.split(" ")[0] || "Account"}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/favorites")}>
                    <Heart className="h-4 w-4 mr-2" /> Favorites
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/notifications")}>
                    <Bell className="h-4 w-4 mr-2" /> Notifications
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/referrals")}>
                    <Gift className="h-4 w-4 mr-2" /> Referrals
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="h-4 w-4 mr-2" /> Settings
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
                  <DropdownMenuItem onClick={() => void handleSignOut()} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
            <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors dark:text-slate-300 dark:hover:text-white">Login</Link>
              <Button asChild size="sm">
                <Link to="/auth?tab=signup">Get Started</Link>
              </Button>
            </>
          )}
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {/* Theme Toggle for mobile */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
          <button className="rounded-lg border border-transparent p-1" onClick={() => setOpen(!open)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-white p-4 md:hidden dark:bg-slate-900 dark:border-slate-700">
          <div className="flex flex-col gap-3">
            <Link to="/marketplace" className={linkClass("/marketplace")} onClick={() => setOpen(false)}>Marketplace</Link>
            <Link to="/categories" className={linkClass("/categories")} onClick={() => setOpen(false)}>Categories</Link>
            {user ? (
              <>
                <Link to="/dashboard" className={linkClass("/dashboard")} onClick={() => setOpen(false)}>Dashboard</Link>
                <Link to="/orders" className={linkClass("/orders")} onClick={() => setOpen(false)}>Orders</Link>
                <Link to="/messages" className={linkClass("/messages")} onClick={() => setOpen(false)}>Messages</Link>
                <Link to="/favorites" className={linkClass("/favorites")} onClick={() => setOpen(false)}>Favorites</Link>
                <Link to="/notifications" className={linkClass("/notifications")} onClick={() => setOpen(false)}>Notifications</Link>
                <Link to="/referrals" className={linkClass("/referrals")} onClick={() => setOpen(false)}>Referrals</Link>
                <Link to="/settings" className={linkClass("/settings")} onClick={() => setOpen(false)}>Settings</Link>
                {isAdmin && (
                  <Link to="/admin" className={linkClass("/admin") + " flex items-center gap-1"} onClick={() => setOpen(false)}>
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin Panel
                  </Link>
                )}
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => { void handleSignOut(); setOpen(false); }}>
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-medium dark:text-white" onClick={() => setOpen(false)}>Login</Link>
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
