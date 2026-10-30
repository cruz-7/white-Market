import { useState, useMemo, useEffect } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
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
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  CreditCard,
  Truck,
  Eye,
  MoreVertical,
  RefreshCw,
  Download,
  Share2,
  Heart,
  TrendingUp,
  Zap,
  Shield,
  Clock as ClockIcon,
  MapPin as LocationIcon,
  User,
  Package2,
  ArrowUpDown,
  SlidersHorizontal,
  Grid3X3,
  List,
  ChevronDown,
  Info,
  ExternalLink,
  Copy,
  CheckCheck,
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

// Sort options
type SortOption = "newest" | "oldest" | "amount_high" | "amount_low" | "status";

// View mode
type ViewMode = "grid" | "list";

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

// Generate friendly order ID
function generateFriendlyOrderId(orderId: string): string {
  const hash = orderId.slice(-6).toUpperCase();
  const prefixes = ["ORD", "PKG", "SHP", "BUY"];
  const prefix = prefixes[Math.abs(hash.charCodeAt(0)) % prefixes.length];
  return `${prefix}-${hash.slice(0, 4)}-${hash.slice(4)}`;
}

// Generate estimated delivery date
function getEstimatedDelivery(status: OrderStatus, createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const daysSinceCreation = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  
  switch (status) {
    case "pending":
      return "Awaiting confirmation";
    case "confirmed":
      return "Ready for meetup";
    case "meetup_scheduled":
      return "Meetup scheduled";
    case "handed_over":
      return "Item received";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "disputed":
      return "Under review";
    default:
      return "Processing";
  }
}

// Get payment method icon and label
function getPaymentInfo(order: Order): { icon: any; label: string; color: string } {
  // Simulate payment method based on order data
  const methods = [
    { icon: CreditCard, label: "Card Payment", color: "text-blue-600" },
    { icon: Zap, label: "Mobile Money", color: "text-green-600" },
    { icon: Shield, label: "Wallet", color: "text-purple-600" },
  ];
  const index = Math.abs(order.id.charCodeAt(0)) % methods.length;
  return methods[index];
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
  gradient: string;
}> = {
  pending: { 
    icon: Clock, 
    color: "text-amber-700", 
    bg: "bg-gradient-to-r from-amber-50 to-amber-100", 
    border: "border-amber-300",
    label: "Order Placed", 
    description: "Waiting for seller confirmation",
    step: 0,
    gradient: "from-amber-400 to-amber-500"
  },
  confirmed: { 
    icon: CheckCircle, 
    color: "text-blue-700", 
    bg: "bg-gradient-to-r from-blue-50 to-blue-100", 
    border: "border-blue-300",
    label: "Confirmed", 
    description: "Seller confirmed and ready to meet",
    step: 1,
    gradient: "from-blue-400 to-blue-500"
  },
  meetup_scheduled: { 
    icon: Calendar, 
    color: "text-purple-700", 
    bg: "bg-gradient-to-r from-purple-50 to-purple-100", 
    border: "border-purple-300",
    label: "Meetup Scheduled", 
    description: "Time and place agreed",
    step: 2,
    gradient: "from-purple-400 to-purple-500"
  },
  handed_over: { 
    icon: Package2, 
    color: "text-teal-700", 
    bg: "bg-gradient-to-r from-teal-50 to-teal-100", 
    border: "border-teal-300",
    label: "Handed Over", 
    description: "Item handed over on campus",
    step: 3,
    gradient: "from-teal-400 to-teal-500"
  },
  completed: { 
    icon: Star, 
    color: "text-green-700", 
    bg: "bg-gradient-to-r from-green-50 to-green-100", 
    border: "border-green-300",
    label: "Completed", 
    description: "Order successfully completed",
    step: 4,
    gradient: "from-green-400 to-green-500"
  },
  cancelled: { 
    icon: X, 
    color: "text-red-700", 
    bg: "bg-gradient-to-r from-red-50 to-red-100", 
    border: "border-red-300",
    label: "Cancelled", 
    description: "Order was cancelled",
    step: -1,
    gradient: "from-red-400 to-red-500"
  },
  disputed: { 
    icon: AlertCircle, 
    color: "text-orange-700", 
    bg: "bg-gradient-to-r from-orange-50 to-orange-100", 
    border: "border-orange-300",
    label: "Disputed", 
    description: "Issue reported - under review",
    step: -1,
    gradient: "from-orange-400 to-orange-500"
  },
};

// Progress stepper component
const OrderProgressStepper = ({ currentStatus }: { currentStatus: string }) => {
  const status = normalizeOrderStatus(currentStatus);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const currentStep = config.step;
  
  const steps = [
    { key: "pending", label: "Placed", icon: ShoppingBag },
    { key: "confirmed", label: "Confirmed", icon: CheckCircle },
    { key: "meetup_scheduled", label: "Scheduled", icon: Calendar },
    { key: "handed_over", label: "Handed Over", icon: Package2 },
  ];

  // For completed orders, add final step
  if (status === "completed") {
    steps.push({ key: "completed", label: "Completed", icon: Star });
  }

  return (
    <div className="w-full">
      {/* Mobile: Vertical stepper */}
      <div className="lg:hidden">
        {steps.map((step, index) => {
          const isCompleted = currentStep > index || status === "completed";
          const isCurrent = currentStep === index;
          const isLast = index === steps.length - 1;
          const StepIcon = step.icon;
          
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                  isCompleted ? "bg-gradient-to-r from-green-400 to-green-500 text-white shadow-lg" : 
                  isCurrent ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg` : 
                  "bg-gray-200 text-gray-500"
                }`}>
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : <StepIcon className="w-4 h-4" />}
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-12 ${isCompleted ? "bg-gradient-to-b from-green-400 to-green-500" : "bg-gray-200"}`} />
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
          const StepIcon = step.icon;
          
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all duration-300 ${
                  isCompleted ? "bg-gradient-to-r from-green-400 to-green-500 text-white shadow-lg" : 
                  isCurrent ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg` : 
                  "bg-gray-200 text-gray-500"
                }`}>
                  {isCompleted ? <CheckCircle className="w-6 h-6" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <p className={`mt-2 text-sm font-medium ${isCurrent ? "text-blue-600" : "text-gray-900"}`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-xs text-gray-500">{config.description}</p>
                )}
              </div>
              {!isLast && (
                <div className={`flex-1 h-1 mx-2 rounded-full ${isCompleted ? "bg-gradient-to-r from-green-400 to-green-500" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Enhanced Order Card Component
const OrderCard = ({ 
  order, 
  onViewDetails, 
  viewMode,
  onCopyOrderId 
}: { 
  order: Order; 
  onViewDetails: (id: string) => void;
  viewMode: ViewMode;
  onCopyOrderId: (id: string) => void;
}) => {
  const statusConfig = STATUS_CONFIG[normalizeOrderStatus(order.status)] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const friendlyId = generateFriendlyOrderId(order.id);
  const paymentInfo = getPaymentInfo(order);
  const PaymentIcon = paymentInfo.icon;
  const estimatedDelivery = getEstimatedDelivery(normalizeOrderStatus(order.status), order.created_at);
  
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyOrderId(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (viewMode === "grid") {
    return (
      <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          {/* Status Banner */}
          <div className={`h-1.5 bg-gradient-to-r ${statusConfig.gradient}`} />
          
          {/* Order Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-gray-900">{friendlyId}</span>
                  <button 
                    onClick={handleCopy}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Copy order ID"
                  >
                    {copied ? (
                      <CheckCheck className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                </div>
                <span className="text-xs text-gray-500 mt-0.5">{timeAgo(order.created_at)}</span>
              </div>
            </div>
            <Badge className={`${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} shadow-sm`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
          
          {/* Product Info */}
          <div className="p-4">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden shrink-0 shadow-inner">
                {order.productImage ? (
                  <img src={order.productImage} alt={order.productTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate text-lg">{order.productTitle}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-sm text-gray-600">{order.sellerName}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <PaymentIcon className={`w-4 h-4 ${paymentInfo.color}`} />
                  <span className="text-sm text-gray-600">{paymentInfo.label}</span>
                </div>
                <p className="font-bold text-xl text-gray-900 mt-2">GHS {order.amount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Status:</span>
              </div>
              <span className="font-medium text-gray-900">{estimatedDelivery}</span>
            </div>
          </div>
          
          {/* Order Actions */}
          <div className="flex items-center justify-between p-4 border-t bg-gradient-to-r from-gray-50 to-white">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900" asChild>
              <Link to="/messages">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </Link>
            </Button>
            <div className="flex gap-2">
              {normalizeOrderStatus(order.status) === "handed_over" && (
                <Button size="sm" className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirm
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onViewDetails(order.id)}
                className="border-gray-300 hover:bg-gray-50"
              >
                <Eye className="w-4 h-4 mr-1" />
                Details
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // List view
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center">
          {/* Status indicator bar */}
          <div className={`w-1.5 self-stretch bg-gradient-to-b ${statusConfig.gradient}`} />
          
          {/* Main content */}
          <div className="flex-1 flex items-center gap-4 p-4">
            {/* Product image */}
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden shrink-0 shadow-inner">
              {order.productImage ? (
                <img src={order.productImage} alt={order.productTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-gray-300" />
                </div>
              )}
            </div>

            {/* Order info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-sm text-gray-900">{friendlyId}</span>
                <button 
                  onClick={handleCopy}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Copy order ID"
                >
                  {copied ? (
                    <CheckCheck className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>
              <h3 className="font-semibold text-gray-900 truncate">{order.productTitle}</h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{order.sellerName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <PaymentIcon className={`w-3 h-3 ${paymentInfo.color}`} />
                  <span>{paymentInfo.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  <span>{timeAgo(order.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Amount and status */}
            <div className="text-right shrink-0">
              <p className="font-bold text-lg text-gray-900">GHS {order.amount.toLocaleString()}</p>
              <Badge className={`${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} mt-1 shadow-sm`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900" asChild>
                <Link to="/messages">
                  <MessageCircle className="w-4 h-4" />
                </Link>
              </Button>
              {normalizeOrderStatus(order.status) === "handed_over" && (
                <Button size="sm" className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirm
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onViewDetails(order.id)}
                className="border-gray-300 hover:bg-gray-50"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
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
  const friendlyId = generateFriendlyOrderId(order.id);
  const paymentInfo = getPaymentInfo(order);
  const PaymentIcon = paymentInfo.icon;
  const estimatedDelivery = getEstimatedDelivery(normalizeOrderStatus(order.status), order.created_at);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-0">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${statusConfig.gradient} flex items-center justify-center`}>
              <StatusIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Order Details</CardTitle>
              <p className="text-sm text-gray-500 font-mono">{friendlyId}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-100">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-xl ${statusConfig.bg} border ${statusConfig.border}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${statusConfig.gradient} flex items-center justify-center shadow-lg`}>
                  <StatusIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className={`font-semibold text-lg ${statusConfig.color}`}>{statusConfig.label}</p>
                  <p className="text-sm text-gray-600">{statusConfig.description}</p>
                </div>
              </div>
              <Badge className={`${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} px-4 py-2 text-sm`}>
                {statusConfig.label}
              </Badge>
            </div>
          </div>
          
          {/* Progress Stepper */}
          <div className="border rounded-xl p-4 bg-gradient-to-r from-gray-50 to-white">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Order Progress
            </h3>
            <OrderProgressStepper currentStatus={order.status} />
          </div>
          
          {/* Product Details */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Product Details
            </h3>
            <div className="flex gap-4">
              <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden shadow-inner">
                {order.productImage ? (
                  <img src={order.productImage} alt={order.productTitle} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{order.productTitle}</h4>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>Seller: {order.sellerName}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <PaymentIcon className={`w-4 h-4 ${paymentInfo.color}`} />
                  <span>{paymentInfo.label}</span>
                </div>
                <p className="font-bold text-2xl mt-3 text-gray-900">GHS {order.amount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-teal-600" />
              Order Summary
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Order Date</p>
                <p className="font-medium text-sm">{new Date(order.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="font-medium text-sm">{estimatedDelivery}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Payment</p>
                <p className="font-medium text-sm">{paymentInfo.label}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Quantity</p>
                <p className="font-medium text-sm">1 item</p>
              </div>
            </div>
          </div>
          
          {/* Seller Info */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Seller Information
            </h3>
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14 ring-2 ring-gray-200">
                <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg">
                  {order.sellerName?.charAt(0) || "S"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-lg">{order.sellerName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-medium">4.8</span>
                  </div>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-600">127 reviews</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-blue-300 text-blue-600 hover:bg-blue-50">
                <Mail className="w-4 h-4 mr-2" />
                Contact
              </Button>
            </div>
          </div>
          
          {/* Order Timeline */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-orange-600" />
              Order Timeline
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5 shadow-sm" />
                <div className="flex-1">
                  <p className="font-medium">Order Placed</p>
                  <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                </div>
              </div>
              {order.status !== "pending" && order.status !== "cancelled" && (
                <div className="flex gap-3">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${statusConfig.gradient} mt-1.5 shadow-sm`} />
                  <div className="flex-1">
                    <p className="font-medium">{statusConfig.label}</p>
                    <p className="text-sm text-gray-500">{statusConfig.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 border-gray-300 hover:bg-gray-50" asChild>
              <Link to="/messages">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat with Seller
              </Link>
            </Button>
            {normalizeOrderStatus(order.status) === "handed_over" && (
              <Button className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md">
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm Received
              </Button>
            )}
            {(normalizeOrderStatus(order.status) === "handed_over" || normalizeOrderStatus(order.status) === "completed") && !ratingSubmitted && (
              <Button 
                variant="outline" 
                className="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                onClick={() => setShowRatingForm(true)}
              >
                <Star className="w-4 h-4 mr-2" />
                Rate Seller
              </Button>
            )}
            {ratingSubmitted && (
              <div className="flex-1 flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-md px-4 py-2 border border-green-200">
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
  const [searchParams] = useSearchParams();
  const requestedOrderId = searchParams.get("orderId");

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  
  // Get orders for current user
  const allOrders = getOrders();
  const orders = user.role === "seller" 
    ? allOrders.filter((o) => o.sellerId === user.id)
    : allOrders.filter((o) => o.buyerId === user.id);

  useEffect(() => {
    if (!requestedOrderId) return;
    const order = orders.find((candidate) => candidate.id === requestedOrderId);
    if (order && order.id !== selectedOrder?.id) setSelectedOrder(order);
  }, [orders, requestedOrderId, selectedOrder?.id]);
  
  // Filter orders by status
  const activeOrders = orders.filter((o) => 
    ["pending", "confirmed", "meetup_scheduled", "handed_over"].includes(normalizeOrderStatus(o.status))
  );
  const historyOrders = orders.filter((o) => 
    ["completed", "cancelled", "disputed"].includes(o.status)
  );
  
  // Apply filters and sorting
  const filteredAndSortedOrders = useMemo(() => {
    const baseOrders = activeTab === "active" ? activeOrders : historyOrders;
    
    // Apply search filter
    let filtered = baseOrders.filter((o) => 
      !searchTerm || 
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      generateFriendlyOrderId(o.id).toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((o) => normalizeOrderStatus(o.status) === filterStatus);
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount_high":
          return b.amount - a.amount;
        case "amount_low":
          return a.amount - b.amount;
        case "status":
          return STATUS_CONFIG[normalizeOrderStatus(a.status)].step - STATUS_CONFIG[normalizeOrderStatus(b.status)].step;
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [activeTab, activeOrders, historyOrders, searchTerm, filterStatus, sortBy]);
  
  const handleViewDetails = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) setSelectedOrder(order);
  };

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
  };

  // Get unique statuses for filter
  const availableStatuses = useMemo(() => {
    const baseOrders = activeTab === "active" ? activeOrders : historyOrders;
    const statuses = [...new Set(baseOrders.map((o) => normalizeOrderStatus(o.status)))];
    return statuses.sort((a, b) => STATUS_CONFIG[a].step - STATUS_CONFIG[b].step);
  }, [activeTab, activeOrders, historyOrders]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  My Orders
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {orders.length} order{orders.length !== 1 ? 's' : ''} total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="border-gray-300"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-none"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input 
                placeholder="Search by order ID, product, or seller..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-gray-200 shadow-sm"
              />
            </div>
            
            {showFilters && (
              <div className="flex flex-wrap gap-3 p-4 bg-white rounded-xl border shadow-sm">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Status:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as OrderStatus | "all")}
                    aria-label="Filter by status"
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    {availableStatuses.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_CONFIG[status].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="Sort orders"
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="amount_high">Price: High to Low</option>
                    <option value="amount_low">Price: Low to High</option>
                    <option value="status">Status</option>
                  </select>
                </div>
                {(filterStatus !== "all" || sortBy !== "newest") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterStatus("all");
                      setSortBy("newest");
                    }}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            )}
            
            {/* Tabs */}
            <div className="flex gap-1 border-b">
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
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Results count */}
        {filteredAndSortedOrders.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredAndSortedOrders.length} of {activeTab === "active" ? activeOrders.length : historyOrders.length} orders
            </p>
          </div>
        )}

        {/* Empty State */}
        {filteredAndSortedOrders.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <ShoppingBag className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">No orders found</h3>
            <p className="text-gray-500 mt-2 mb-6 max-w-md mx-auto">
              {searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filters"
                : activeTab === "active" 
                  ? "You don't have any active orders right now. Start shopping to see your orders here!"
                  : "Your completed and cancelled orders will appear here"}
            </p>
            {!searchTerm && filterStatus === "all" && (
              <Button asChild className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg">
                <Link to="/marketplace">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Start Shopping
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Orders Grid/List */}
        {filteredAndSortedOrders.length > 0 && (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" 
            : "space-y-3"
          }>
            {filteredAndSortedOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onViewDetails={handleViewDetails}
                viewMode={viewMode}
                onCopyOrderId={handleCopyOrderId}
              />
            ))}
          </div>
        )}
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
