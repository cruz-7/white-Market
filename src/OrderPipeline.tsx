import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { Button } from "./button";
import { Link } from "react-router-dom";
import { Clock, CheckCircle, Truck, AlertTriangle, XCircle, Package, ThumbsUp } from "lucide-react";

interface OrderPipelineProps {
  orders: any[];
  type: "seller" | "buyer";
  onUpdateStatus?: (jobId: string, status: string) => void;
}

const STATUS_STEPS = ["pending", "confirmed", "delivered", "completed"];

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10 border-warning/30", label: "Pending" },
  confirmed: { icon: CheckCircle, color: "text-primary", bg: "bg-primary/10 border-primary/30", label: "Confirmed" },
  delivered: { icon: Truck, color: "text-accent", bg: "bg-accent/10 border-accent/30", label: "Delivered" },
  completed: { icon: ThumbsUp, color: "text-success", bg: "bg-success/10 border-success/30", label: "Completed" },
  disputed: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", label: "Disputed" },
  cancelled: { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted border-muted-foreground/20", label: "Cancelled" },
  // Legacy statuses mapped
  requested: { icon: Clock, color: "text-warning", bg: "bg-warning/10 border-warning/30", label: "Pending" },
  accepted: { icon: CheckCircle, color: "text-primary", bg: "bg-primary/10 border-primary/30", label: "Confirmed" },
  in_progress: { icon: Truck, color: "text-accent", bg: "bg-accent/10 border-accent/30", label: "Processing" },
};

const StatusTracker = ({ currentStatus }: { currentStatus: string }) => {
  const normalizedStatus = currentStatus === "requested" ? "pending" 
    : currentStatus === "accepted" ? "confirmed" 
    : currentStatus === "in_progress" ? "delivered" 
    : currentStatus;
  
  const currentIdx = STATUS_STEPS.indexOf(normalizedStatus);
  const isDisputed = currentStatus === "disputed";

  return (
    <div className="flex items-center gap-1 mt-2">
      {STATUS_STEPS.map((step, i) => {
        const isDone = !isDisputed && currentIdx >= i;
        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${isDone ? "bg-primary" : isDisputed ? "bg-destructive/30" : "bg-muted"}`} />
          </div>
        );
      })}
    </div>
  );
};

const OrderPipeline = ({ orders, type, onUpdateStatus }: OrderPipelineProps) => {
  if (orders.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            {type === "seller" ? "No orders yet. Share your products to get your first sale!" : "You haven't placed any orders yet."}
          </p>
          {type === "buyer" && (
            <Button asChild size="sm"><Link to="/marketplace">Browse Products</Link></Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((job) => {
        const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
        const StatusIcon = config.icon;

        return (
          <Card key={job.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${config.bg} shrink-0 mt-0.5`}>
                  <StatusIcon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{job.description || "Order"}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {type === "seller" ? `From: ${job.profiles?.full_name || "Buyer"}` : `Seller: ${job.profiles?.full_name || "Seller"}`}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${config.bg} ${config.color}`}>
                      {config.label}
                    </Badge>
                  </div>

                  {/* Status Step Tracker */}
                  <StatusTracker currentStatus={job.status} />

                  <div className="flex items-center justify-between mt-2">
                    <p className="font-display font-bold text-sm text-primary">GHS {job.agreed_price}</p>
                    <div className="flex gap-1.5">
                      {type === "seller" && onUpdateStatus && (
                        <>
                          {(job.status === "requested" || job.status === "pending") && (
                            <>
                              <Button size="sm" className="h-7 text-xs" onClick={() => onUpdateStatus(job.id, "confirmed")}>Confirm</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onUpdateStatus(job.id, "cancelled")}>Decline</Button>
                            </>
                          )}
                          {(job.status === "accepted" || job.status === "confirmed") && (
                            <Button size="sm" className="h-7 text-xs" onClick={() => onUpdateStatus(job.id, "delivered")}>Mark Delivered</Button>
                          )}
                        </>
                      )}
                      {type === "buyer" && onUpdateStatus && (
                        <>
                          {job.status === "delivered" && (
                            <Button size="sm" className="h-7 text-xs bg-success hover:bg-success/90" onClick={() => onUpdateStatus(job.id, "completed")}>Confirm Received</Button>
                          )}
                        </>
                      )}
                      {/* Either party can dispute */}
                      {onUpdateStatus && !["completed", "cancelled", "disputed"].includes(job.status) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30" onClick={() => onUpdateStatus(job.id, "disputed")}>Dispute</Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <Link to="/messages?back=/orders">Chat</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default OrderPipeline;
