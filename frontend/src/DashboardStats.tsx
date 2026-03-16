import { Card, CardContent } from "./card";
import { Package, ShoppingBag, Star, DollarSign, TrendingUp, TrendingDown } from "lucide-react";

interface DashboardStatsProps {
  totalProducts: number;
  totalSales: number;
  totalEarnings: number;
  pendingOrders: number;
}

const DashboardStats = ({ totalProducts, totalSales, totalEarnings, pendingOrders }: DashboardStatsProps) => {
  const stats = [
    {
      label: "Products Listed",
      value: totalProducts,
      icon: Package,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
      trend: "+2 this week",
      trendUp: true,
    },
    {
      label: "Total Sales",
      value: totalSales,
      icon: ShoppingBag,
      iconColor: "text-accent",
      bgColor: "bg-accent/10",
      trend: totalSales > 0 ? "Keep it up!" : "Start selling",
      trendUp: totalSales > 0,
    },
    {
      label: "Total Earned",
      value: `GHS ${totalEarnings}`,
      icon: DollarSign,
      iconColor: "text-success",
      bgColor: "bg-success/10",
      trend: totalEarnings > 0 ? "+12% this month" : "No earnings yet",
      trendUp: totalEarnings > 0,
    },
    {
      label: "Pending Orders",
      value: pendingOrders,
      icon: Star,
      iconColor: "text-warning",
      bgColor: "bg-warning/10",
      trend: pendingOrders > 0 ? "Action needed" : "All clear",
      trendUp: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="relative overflow-hidden group hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
              {stat.trendUp ? (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <p className="font-display text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">{stat.trend}</p>
          </CardContent>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/[0.02] group-hover:to-primary/[0.05] transition-colors" />
        </Card>
      ))}
    </div>
  );
};

export default DashboardStats;
