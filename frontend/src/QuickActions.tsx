import { Card, CardContent } from "./card";
import { Link } from "react-router-dom";
import { Plus, Eye, Settings, Share2 } from "lucide-react";
import { toast } from "sonner";

interface QuickActionsProps {
  sellerId?: string;
}

const QuickActions = ({ sellerId }: QuickActionsProps) => {
  const actions = [
    { icon: Plus, label: "Add Product", to: "/dashboard?sell=1", color: "bg-primary/10 text-primary" },
    { icon: Eye, label: "View Store", to: sellerId ? `/marketplace?seller=${sellerId}` : "/marketplace", color: "bg-accent/10 text-accent" },
    { icon: Settings, label: "Edit Profile", to: "/profile-setup", color: "bg-muted text-muted-foreground" },
    {
      icon: Share2,
      label: "Share Store",
      to: "#",
      color: "bg-success/10 text-success",
      onClick: () => {
        if (sellerId) {
          navigator.clipboard.writeText(`${window.location.origin}/store/${sellerId}`);
          toast.success("Store link copied!");
        }
      },
    },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-display font-semibold text-sm mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            action.onClick ? (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
              >
                <div className={`p-1.5 rounded-md ${action.color}`}>
                  <action.icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ) : (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className={`p-1.5 rounded-md ${action.color}`}>
                  <action.icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium">{action.label}</span>
              </Link>
            )
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActions;
