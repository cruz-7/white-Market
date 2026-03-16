import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Badge } from "./badge";
import { Button } from "./button";
import { Link } from "react-router-dom";
import { CheckCircle, Settings, LogOut } from "lucide-react";

interface DashboardHeaderProps {
  profile: any;
  email: string;
  onSignOut: () => void;
}

const DashboardHeader = ({ profile, email, onSignOut }: DashboardHeaderProps) => {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-teal-light to-accent/10 p-4 sm:p-6 mb-6">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 border-2 border-primary/20">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {profile?.full_name?.slice(0, 2)?.toUpperCase() || "??"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
              {profile?.store_name || profile?.full_name || "Student"}
              {profile?.is_verified && <CheckCircle className="h-4 w-4 text-primary" />}
            </h1>
            <p className="text-xs text-muted-foreground">{email}</p>
            {profile?.is_verified ? (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary mt-1">Verified Seller</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-warning/30 text-warning mt-1">Unverified</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" asChild>
            <Link to="/profile-setup"><Settings className="h-3.5 w-3.5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSignOut}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-accent/5 blur-2xl" />
    </div>
  );
};

export default DashboardHeader;
