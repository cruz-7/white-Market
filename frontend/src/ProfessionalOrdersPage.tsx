import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Package,
  CheckCircle,
  Clock,
  MapPin,
  Mail,
  ChevronRight,
  ArrowLeft,
  ShoppingBag,
  Star,
  MessageCircle,
  AlertCircle,
  X,
  Search,
} from "lucide-react";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { Avatar, AvatarFallback } from "./avatar";
import { getOrders, LocalUser, Order, timeAgo } from "./data";
import { SellerRating } from "./SellerRating";
import { ratingsApi } from "./api";
type Props = {
  user: LocalUser | null;
};

// Order status types
type OrderStatus = "pending" | "confirmed" | "meetup_scheduled" | "handed_over" | "completed" | "cancelled" | "disputed";

function normalizeOrderStatus(status: string): OrderStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "paid":
    case "confirmed":
      return "confirmed";
    case "meetup_scheduled":
      return "meetup_scheduled";
    case "handed_over":
      return "handed_over";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "disputed":
      return "disputed";
    // Legacy statuses (shipping-style) mapped to campus handover flow.
    case "processing":
      return "confirmed";
    case "shipped":
      return "meetup_scheduled";
    case "delivered":
      return "handed_over";
    default:
      return "pending";
  }
}

// Status configuration for professional look
const STATUS_CONFIG: Record<OrderStatus, { 
  icon: any; 
  color: string; 
  bg: string; 
  border: string;
  label: string;
  description: string;
  step: number;
}> = {
  pending: { 
    icon: Clock, 
    color: "text-amber-600", 
    bg: "bg-amber-50", 
    border: "border-amber-200",
    label: "Order Placed", 
    description: "Waiting for seller confirmation",
    step: 0
  },
  confirmed: { 
    icon: CheckCircle, 
    color: "text-blue-600", 
    bg: "bg-blue-50", 
    border: "border-blue-200",
    label: "Confirmed", 
    description: "Seller confirmed and ready to meet",
    step: 1
  },
  meetup_scheduled: { 
    icon: Package, 
    color: "text-purple-600", 
    bg: "bg-purple-50", 
    border: "border-purple-200",
    label: "Meetup Scheduled", 
    description: "Time and place agreed",
    step: 2
  },
  handed_over: { 
    icon: MapPin, 
    color: "text-teal-600", 
    bg: "bg-teal-50", 
    border: "border-teal-200",
    label: "Handed Over", 
    description: "Item handed over on campus",
    step: 3
  },
  completed: { 
    icon: Star, 
    color: "text-green-600", 
    bg: "bg-green-50", 
    border: "border-green-200",
    label: "Completed", 
    description: "Order successfully completed",
    step: 4
  },
  cancelled: { 
    icon: X, 
    color: "text-red-600", 
    bg: "bg-red-50", 
    border: "border-red-200",
    label: "Cancelled", 
    description: "Order was cancelled",
    step: -1
  },
  disputed: { 
    icon: AlertCircle, 
    color: "text-orange-600", 
    bg: "bg-orange-50", 
    border: "border-orange-200",
    label: "Disputed", 
    description: "Issue reported - under review",
    step: -1
  },
};

// Progress stepper component
const OrderProgressStepper = ({ currentStatus }: { currentStatus: string }) => {
  const status = normalizeOrderStatus(currentStatus);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const currentStep = config.step;
  
  const steps = [
    { key: "pending", label: "Order Placed" },
    { key: "confirmed", label: "Confirmed" },
    { key: "meetup_scheduled", label: "Meetup Scheduled" },
    { key: "handed_over", label: "Handed Over" },
  ];

  // For completed orders, add final step
  if (status === "completed") {
    steps.push({ key: "completed", label: "Completed" });
  }

  return (
    <div className="w-full">
      {/* Mobile: Vertical stepper */}
      <div className="lg:hidden">
        {steps.map((step, index) => {
          const isCompleted = currentStep > index || status === "completed";
          const isCurrent = currentStep === index;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isCompleted ? "bg-green-500 text-white" : 
                  isCurrent ? "bg-blue-500 text-white" : 
                  "bg-gray-200 text-gray-500"
                }`}>
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-12 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`} />
                )}
              </div>
              <div className="pb-6">
                <p className={`font-medium ${isCurrent ? "text-blue-600" : "text-gray-900"}`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-sm text-gray-500">{config.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Desktop: Horizontal stepper */}
      <div className="hidden lg:flex items-center justify-between w-full">
        {steps.map((step, index) => {
          const isCompleted = currentStep > index || status === "completed";
          const isCurrent = currentStep === index;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium ${
                  isCompleted ? "bg-green-500 text-white" : 
                  isCurrent ? "bg-blue-500 text-white" : 
                  "bg-gray-200 text-gray-500"
                }`}>
                  {isCompleted ? <CheckCircle className="w-6 h-6" /> : index + 1}
                </div>
                <p className={`mt-2 text-sm font-medium ${isCurrent ? "text-blue-600" : "text-gray-900"}`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-xs text-gray-500">{config.description}</p>
                )}
              </div>
              {!isLast && (
                <div className={`flex-1 h-1 mx-2 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Single Order Card Component
const OrderCard = ({ order, onViewDetails }: { order: Order; onViewDetails: (id: string) => void }) => {
  const statusConfig = STATUS_CONFIG[normalizeOrderStatus(order.status)] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        {/* Order Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
          <div>
            <p className="text-xs text-gray-500">Order ID</p>
            <p className="font-mono font-semibold text-sm">#{order.id.slice(-8).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{timeAgo(order.created_at)}</p>
            <Badge className={`${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} mt-1`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
        
        {/* Product Info */}
        <div className="p-4">
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0">
              {order.productImage ? (
                <img src={order.productImage} alt={order.productTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-300" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{order.productTitle}</h3>
              <p className="text-sm text-gray-500 mt-1">Seller: {order.sellerName}</p>
              <p className="font-bold text-lg text-gray-900 mt-2">GHS {order.amount}</p>
            </div>
          </div>
        </div>
        
        {/* Order Actions */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50/50">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/messages">
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </Link>
          </Button>
          <div className="flex gap-2">
            {normalizeOrderStatus(order.status) === "handed_over" && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-1" />
                Confirm Received
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onViewDetails(order.id)}>
              View Details
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Order Details Modal
const OrderDetailsModal = ({ order, onClose }: { order: Order | null; onClose: () => void }) => {
  if (!order) return null;
  
  const statusConfig = STATUS_CONFIG[normalizeOrderStatus(order.status)] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  
  const handleRatingSubmit = async (ratingData: any) => {
    try {
      await ratingsApi.submitRating({
        order_id: order.id,
        seller_id: order.sellerId,
        ...ratingData,
      });
      setRatingSubmitted(true);
      setShowRatingForm(false);
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Failed to submit rating. Please try again.");
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b z-10">
          <CardTitle>Order Details</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Order ID & Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="font-mono font-bold text-lg">#{order.id.slice(-8).toUpperCase()}</p>
            </div>
            <Badge className={`${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} px-4 py-2`}>
              <StatusIcon className="w-4 h-4 mr-2" />
              {statusConfig.label}
            </Badge>
          </div>
          
          {/* Progress Stepper */}
          <div className="border rounded-xl p-4">
            <h3 className="font-semibold mb-4">Order Progress</h3>
            <OrderProgressStepper currentStatus={order.status} />
          </div>
          
          {/* Product Details */}
          <div className="border rounded-xl p-4">
            <h3 className="font-semibold mb-4">Product Details</h3>
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-lg bg-gray-100 overflow-hidden">
                {order.productImage ? (
                  <img src={order.productImage} alt={order.productTitle} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">{order.productTitle}</h4>
                <p className="text-sm text-gray-500 mt-1">Product details</p>
                <p className="font-bold text-xl mt-2">GHS {order.amount}</p>
              </div>
            </div>
          </div>
          
          {/* Seller Info */}
          <div className="border rounded-xl p-4">
            <h3 className="font-semibold mb-4">Seller Information</h3>
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12">
                <AvatarFallback>{order.sellerName?.charAt(0) || "S"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{order.sellerName}</p>
                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600">
                  <Mail className="w-3 h-3 mr-1" />
                  Contact Seller
                </Button>
              </div>
            </div>
          </div>
          
          {/* Order Timeline */}
          <div className="border rounded-xl p-4">
            <h3 className="font-semibold mb-4">Order Timeline</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                <div>
                  <p className="font-medium text-sm">Order Placed</p>
                  <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                </div>
              </div>
              {order.status !== "pending" && order.status !== "cancelled" && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <div>
                    <p className="font-medium text-sm">{statusConfig.label}</p>
                    <p className="text-xs text-gray-500">Your order is {statusConfig.label.toLowerCase()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/messages">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat with Seller
              </Link>
            </Button>
            {normalizeOrderStatus(order.status) === "handed_over" && (
              <Button className="flex-1 bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm Received
              </Button>
            )}
            {(normalizeOrderStatus(order.status) === "handed_over" || normalizeOrderStatus(order.status) === "completed") && !ratingSubmitted && (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowRatingForm(true)}
              >
                <Star className="w-4 h-4 mr-2" />
                Rate Seller
              </Button>
            )}
            {ratingSubmitted && (
              <div className="flex-1 flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-md px-4 py-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Rating Submitted!</span>
              </div>
            )}
          </div>
          
          {/* Rating Form Modal */}
          {showRatingForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
              <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <SellerRating
                  orderId={order.id}
                  sellerId={order.sellerId}
                  sellerName={order.sellerName || "Seller"}
                  sellerAvatar={undefined}
                  onSubmit={handleRatingSubmit}
                  onCancel={() => setShowRatingForm(false)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function ProfessionalOrdersPage({ user }: Props) {
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Get orders for current user
  const allOrders = getOrders();
  const orders = user.role === "seller" 
    ? allOrders.filter((o) => o.sellerId === user.id)
    : allOrders.filter((o) => o.buyerId === user.id);
  
  // Filter orders by status
  const activeOrders = orders.filter((o) => 
    ["pending", "confirmed", "meetup_scheduled", "handed_over"].includes(normalizeOrderStatus(o.status))
  );
  const historyOrders = orders.filter((o) => 
    ["completed", "cancelled", "disputed"].includes(o.status)
  );
  
  // Filter by search term
  const filteredActiveOrders = activeOrders.filter((o) => 
    !searchTerm || 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.sellerName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredHistoryOrders = historyOrders.filter((o) => 
    !searchTerm || 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.sellerName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const displayedOrders = activeTab === "active" ? filteredActiveOrders : filteredHistoryOrders;
  
  const handleViewDetails = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) setSelectedOrder(order);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">My Orders</h1>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "active" 
                  ? "border-blue-500 text-blue-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Active Orders
              {activeOrders.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                  {activeOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "history" 
                  ? "border-blue-500 text-blue-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Order History
              {historyOrders.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {historyOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Empty State */}
        {displayedOrders.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No orders found</h3>
            <p className="text-gray-500 mt-2 mb-6">
              {activeTab === "active" 
                ? "You don't have any active orders right now"
                : "Your completed and cancelled orders will appear here"}
            </p>
            <Button asChild>
              <Link to="/marketplace">Start Shopping</Link>
            </Button>
          </div>
        )}

        {/* Orders List */}
        <div className="space-y-4">
          {displayedOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}
    </div>
  );
}



