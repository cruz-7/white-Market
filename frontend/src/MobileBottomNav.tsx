import { Link, useLocation } from "react-router-dom";
import { Home, Search, PlusCircle, Package, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./lib/utils";
import { getUnreadCount, subscribeDataChange } from "./data";
import { useCart } from "./CartContext";

const NAV_ITEMS = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/marketplace", icon: Search, label: "Browse" },
  { to: "/orders", icon: Package, label: "Orders", showBadge: true },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);
  const { itemCount } = useCart();

  useEffect(() => {
    const update = () => {
      const raw = localStorage.getItem("wm_user");
      if (!raw) return setUnread(0);
      try {
        const user = JSON.parse(raw) as { id: string };
        setUnread(getUnreadCount(user.id));
      } catch {
        setUnread(0);
      }
    };

    update();
    return subscribeDataChange(update);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 shadow-[0_-6px_20px_rgba(0,0,0,0.06)] backdrop-blur-sm md:hidden">
      <div className="flex h-14 items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to.split("?")[0]));
          return (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon className={cn("h-5 w-5", item.label === "Sell" && "h-6 w-6 text-accent")} />
                {(item.showBadge && itemCount > 0) && (
                  <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-rose-500 px-1 text-[9px] text-white">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
                {item.label === "Messages" && unread > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red-500 px-1 text-[9px] text-white">
                    {unread}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
