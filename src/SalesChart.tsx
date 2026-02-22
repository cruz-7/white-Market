import { Card, CardContent } from "./card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface SalesChartProps {
  jobs: any[];
}

const SalesChart = ({ jobs }: SalesChartProps) => {
  // Generate last 7 days of data
  const now = new Date();
  const data = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    const dayStr = date.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = date.toISOString().split("T")[0];

    const daySales = jobs.filter((j) => {
      const jDate = new Date(j.created_at).toISOString().split("T")[0];
      return jDate === dateStr && j.status === "completed";
    });

    return {
      day: dayStr,
      sales: daySales.length,
      revenue: daySales.reduce((a: number, j: any) => a + Number(j.agreed_price), 0),
    };
  });

  const totalRevenue = data.reduce((a, d) => a + d.revenue, 0);
  const totalOrders = data.reduce((a, d) => a + d.sales, 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-sm">Sales Overview</h3>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </div>
          <div className="text-right">
            <p className="font-display font-bold text-lg text-primary">GHS {totalRevenue}</p>
            <p className="text-[10px] text-muted-foreground">{totalOrders} orders</p>
          </div>
        </div>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(174, 62%, 38%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(174, 62%, 38%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(210, 12%, 50%)" }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(210, 20%, 90%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [
                  name === "revenue" ? `GHS ${value}` : value,
                  name === "revenue" ? "Revenue" : "Orders",
                ]}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(174, 62%, 38%)" fill="url(#salesGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesChart;
