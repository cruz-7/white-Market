import { useState, useEffect, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Users,
  Star,
  Bell,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Gift,
  Percent,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MessageSquare,
  Settings,
  HelpCircle,
} from "lucide-react";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Badge } from "./badge";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { productsApi, ordersApi, userApi, reviewsApi, type Product, type Order } from "./api";
import { useCurrentUser } from "./App";
import { EnhancedProductManagement } from "./EnhancedProductManagement";

interface SellerStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  averageRating: number;
  totalReviews: number;
  totalCustomers: number;
  conversionRate: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
}

interface Review {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  reply?: string;
}

interface Transaction {
  id: string;
  type: "sale" | "payout" | "refund" | "fee";
  amount: number;
  description: string;
  date: string;
  status: "completed" | "pending" | "failed";
}

interface Notification {
  id: string;
  type: "order" | "review" | "stock" | "payment" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minPurchase: number;
  maxUses: number;
  currentUses: number;
  expiresAt: string;
  active: boolean;
}

export default function SellerDashboard({ initialTab = "overview" }: { initialTab?: string }) {
  const user = useCurrentUser();
  
  // Redirect if not a seller or admin
  if (!user || (user.role !== "seller" && user.role !== "admin")) {
    return <Navigate to="/" replace />;
  }
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<SellerStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    averageRating: 0,
    totalReviews: 0,
    totalCustomers: 0,
    conversionRate: 0,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    analytics: true,
    products: true,
    orders: true,
  });

  // Coupon form state
  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: 10,
    minPurchase: 0,
    maxUses: 100,
    expiresAt: "",
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) return;
      const [productsRes, ordersRes] = await Promise.all([
        productsApi.getAll({ seller_id: user.id }),
        ordersApi.getSales(),
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data);
      }

      if (ordersRes.data) {
        setOrders(ordersRes.data);
      }

      // Calculate stats
      const activeProducts = productsRes.data?.filter((p) => p.is_active).length || 0;
      const pendingOrders = ordersRes.data?.filter((o) => o.status === "pending").length || 0;
      const completedOrders = ordersRes.data?.filter((o) => o.status === "completed").length || 0;
      const totalRevenue = ordersRes.data?.reduce((sum, o) => sum + (o.amount || 0), 0) || 0;

      // Calculate monthly revenue (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthlyRevenue =
        ordersRes.data
          ?.filter((o) => new Date(o.created_at) >= thirtyDaysAgo && o.status === "completed")
          .reduce((sum, o) => sum + (o.amount || 0), 0) || 0;

      // Get unique customers
      const uniqueCustomers = new Set(ordersRes.data?.map((o) => o.buyer_id) || []);

      // Fetch actual review data
      const reviewsRes = await reviewsApi.getForSeller(user.id);
      const averageRating = reviewsRes.data?.rating || 0;
      const totalReviews = reviewsRes.data?.review_count || 0;

      setStats({
        totalProducts: productsRes.data?.length || 0,
        activeProducts,
        totalOrders: ordersRes.data?.length || 0,
        pendingOrders,
        completedOrders,
        totalRevenue,
        monthlyRevenue,
        averageRating,
        totalReviews,
        totalCustomers: uniqueCustomers.size,
        conversionRate: uniqueCustomers.size > 0 ? (completedOrders / uniqueCustomers.size) * 100 : 0,
      });

      // Build customers list from orders
      const customerMap = new Map<string, Customer>();
      ordersRes.data?.forEach((order) => {
        if (order.buyer_id && !customerMap.has(order.buyer_id)) {
          customerMap.set(order.buyer_id, {
            id: order.buyer_id,
            name: "Customer",
            email: "",
            totalOrders: 0,
            totalSpent: 0,
            lastOrderDate: order.created_at,
          });
        }
        const customer = customerMap.get(order.buyer_id!);
        if (customer) {
          customer.totalOrders++;
          customer.totalSpent += order.amount || 0;
          if (new Date(order.created_at) > new Date(customer.lastOrderDate)) {
            customer.lastOrderDate = order.created_at;
          }
        }
      });
      setCustomers(Array.from(customerMap.values()));

      // Mock data for other sections
      setReviews([]);
      setTransactions([]);
      setNotifications([]);
      setCoupons([]);

      // Check if first time user
      const hasSeenOnboarding = localStorage.getItem("seller_onboarding_complete");
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleToggleStock = async (productId: string, inStock: boolean) => {
    try {
      await productsApi.update(productId, { is_active: inStock });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: inStock } : p))
      );
      toast.success(inStock ? "Product marked as active" : "Product marked as inactive");
    } catch (error) {
      toast.error("Failed to update product status");
    }
  };



  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await productsApi.delete(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      toast.success("Product deleted");
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedProducts.length === 0) {
      toast.error("Please select products first");
      return;
    }

    try {
      switch (action) {
        case "activate":
          await Promise.all(selectedProducts.map((id) => productsApi.update(id, { is_active: true })));
          setProducts((prev) =>
            prev.map((p) => (selectedProducts.includes(p.id) ? { ...p, is_active: true } : p))
          );
          toast.success(`${selectedProducts.length} products activated`);
          break;
        case "deactivate":
          await Promise.all(selectedProducts.map((id) => productsApi.update(id, { is_active: false })));
          setProducts((prev) =>
            prev.map((p) => (selectedProducts.includes(p.id) ? { ...p, is_active: false } : p))
          );
          toast.success(`${selectedProducts.length} products deactivated`);
          break;
        case "delete":
          if (!confirm(`Are you sure you want to delete ${selectedProducts.length} products?`)) return;
          await Promise.all(selectedProducts.map((id) => productsApi.delete(id)));
          setProducts((prev) => prev.filter((p) => !selectedProducts.includes(p.id)));
          toast.success(`${selectedProducts.length} products deleted`);
          break;
      }
      setSelectedProducts([]);
    } catch (error) {
      toast.error("Bulk action failed");
    }
  };

  const handleCreateCoupon = async () => {
    try {
      // API call would go here
      const newCoupon: Coupon = {
        id: Date.now().toString(),
        ...couponForm,
        currentUses: 0,
        active: true,
      };
      setCoupons((prev) => [...prev, newCoupon]);
      setShowCouponDialog(false);
      setCouponForm({
        code: "",
        discountType: "percentage",
        discountValue: 10,
        minPurchase: 0,
        maxUses: 100,
        expiresAt: "",
      });
      toast.success("Coupon created successfully");
    } catch (error) {
      toast.error("Failed to create coupon");
    }
  };

  const handleToggleCoupon = async (couponId: string) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === couponId ? { ...c, active: !c.active } : c))
    );
    toast.success("Coupon status updated");
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    setCoupons((prev) => prev.filter((c) => c.id !== couponId));
    toast.success("Coupon deleted");
  };

  const handleReplyToReview = async (reviewId: string, reply: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, reply } : r))
    );
    toast.success("Reply posted");
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const handleCompleteOnboarding = () => {
    localStorage.setItem("seller_onboarding_complete", "true");
    setShowOnboarding(false);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Seller Dashboard</h1>
              <p className="text-sm text-gray-500">Manage your products, orders, and sales</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setShowOnboarding(true)}>
                <BookOpen className="h-4 w-4 mr-2" />
                Guide
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="relative" onClick={() => setActiveTab("notifications")}>
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border rounded-lg p-1 flex flex-wrap gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="coupons" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Coupons
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
              {unreadNotifications > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {unreadNotifications}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">GHS {stats.totalRevenue.toFixed(2)}</p>
                      <p className="text-xs text-green-600 mt-1">
                        <TrendingUp className="h-3 w-3 inline mr-1" />
                        GHS {stats.monthlyRevenue.toFixed(2)} this month
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Orders</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                      <p className="text-xs text-yellow-600 mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {stats.pendingOrders} pending
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Active Products</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeProducts}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        of {stats.totalProducts} total
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Customers</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {stats.conversionRate.toFixed(1)}% conversion
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-500">
                      <Star className="h-6 w-6 inline mr-1" />
                      {stats.averageRating.toFixed(1)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Average Rating</p>
                    <p className="text-xs text-gray-400">{stats.totalReviews} reviews</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-500">
                      {stats.completedOrders}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Completed Orders</p>
                    <p className="text-xs text-gray-400">
                      {stats.totalOrders > 0
                        ? ((stats.completedOrders / stats.totalOrders) * 100).toFixed(1)
                        : 0}
                      % completion rate
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-500">
                      GHS {stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : "0.00"}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Average Order Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Orders</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("orders")}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No orders yet</p>
                ) : (
                  <div className="space-y-4">
                    {orders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">Order #{order.id.slice(-8)}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">GHS {order.amount?.toFixed(2)}</p>
                          <Badge
                            variant={
                              order.status === "completed"
                                ? "default"
                                : order.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <EnhancedProductManagement
              products={products}
              onToggleStock={handleToggleStock}
              onDeleteProduct={handleDeleteProduct}
              onBulkAction={handleBulkAction}
              onRefresh={() => window.location.reload()}
            />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>Track and manage your orders</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-medium">Order #{order.id.slice(-8)}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant={
                              order.status === "completed"
                                ? "default"
                                : order.status === "pending"
                                ? "secondary"
                                : order.status === "cancelled"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">
                              Buyer ID: {order.buyer_id || "Unknown"}
                            </p>
                            <p className="text-sm text-gray-500">
                              Product: {order.products?.title || "Unknown"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">GHS {order.amount?.toFixed(2)}</p>
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/orders/${order.id}`}>View Details</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Database</CardTitle>
                <CardDescription>View and manage your customer relationships</CardDescription>
              </CardHeader>
              <CardContent>
                {customers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No customers yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">Customer</th>
                          <th className="text-left py-3 px-4">Email</th>
                          <th className="text-left py-3 px-4">Orders</th>
                          <th className="text-left py-3 px-4">Total Spent</th>
                          <th className="text-left py-3 px-4">Last Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map((customer) => (
                          <tr key={customer.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {customer.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{customer.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-500">{customer.email}</td>
                            <td className="py-3 px-4">{customer.totalOrders}</td>
                            <td className="py-3 px-4 font-medium">
                              GHS {customer.totalSpent.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-gray-500">
                              {new Date(customer.lastOrderDate).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Management</CardTitle>
                <CardDescription>View and respond to customer reviews</CardDescription>
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No reviews yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{review.customerName}</p>
                            <p className="text-sm text-gray-500">{review.productName}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-gray-600 mb-4">{review.comment}</p>
                        {review.reply ? (
                          <div className="bg-gray-50 rounded-lg p-3 mt-2">
                            <p className="text-sm font-medium">Your Reply:</p>
                            <p className="text-sm text-gray-600">{review.reply}</p>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <Textarea
                              placeholder="Write a reply..."
                              className="mb-2"
                              id={`reply-${review.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const textarea = document.getElementById(
                                  `reply-${review.id}`
                                ) as HTMLTextAreaElement;
                                if (textarea.value) {
                                  handleReplyToReview(review.id, textarea.value);
                                }
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Reply
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>View your earnings and payouts</CardDescription>
                  </div>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              transaction.type === "sale"
                                ? "bg-green-100"
                                : transaction.type === "payout"
                                ? "bg-blue-100"
                                : transaction.type === "refund"
                                ? "bg-red-100"
                                : "bg-gray-100"
                            }`}
                          >
                            <DollarSign
                              className={`h-5 w-5 ${
                                transaction.type === "sale"
                                  ? "text-green-600"
                                  : transaction.type === "payout"
                                  ? "text-blue-600"
                                  : transaction.type === "refund"
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(transaction.date).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-bold ${
                              transaction.type === "sale" ? "text-green-600" : "text-gray-900"
                            }`}
                          >
                            {transaction.type === "sale" ? "+" : ""}
                            GHS {transaction.amount.toFixed(2)}
                          </p>
                          <Badge
                            variant={
                              transaction.status === "completed"
                                ? "default"
                                : transaction.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {transaction.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Discount Coupons</CardTitle>
                    <CardDescription>Create and manage discount codes for your products</CardDescription>
                  </div>
                  <Button onClick={() => setShowCouponDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Coupon
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {coupons.length === 0 ? (
                  <div className="text-center py-12">
                    <Gift className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No coupons created yet</p>
                    <Button className="mt-4" onClick={() => setShowCouponDialog(true)}>
                      Create Your First Coupon
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {coupons.map((coupon) => (
                      <div
                        key={coupon.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-100 px-2 py-1 rounded font-mono font-bold">
                              {coupon.code}
                            </code>
                            <Badge variant={coupon.active ? "default" : "secondary"}>
                              {coupon.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {coupon.discountType === "percentage"
                              ? `${coupon.discountValue}% off`
                              : `GHS ${coupon.discountValue} off`}
                            {coupon.minPurchase > 0 && ` • Min. GHS ${coupon.minPurchase}`}
                            • {coupon.currentUses}/{coupon.maxUses} uses
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Expires: {new Date(coupon.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleCoupon(coupon.id)}
                          >
                            {coupon.active ? (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Stay updated with your store activity</CardDescription>
                  </div>
                  {unreadNotifications > 0 && (
                    <Button variant="outline" size="sm" onClick={handleMarkAllNotificationsRead}>
                      Mark All as Read
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No notifications</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border rounded-lg ${
                          !notification.read ? "bg-blue-50 border-blue-200" : ""
                        }`}
                        onClick={() => handleMarkNotificationRead(notification.id)}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              notification.type === "order"
                                ? "bg-green-100"
                                : notification.type === "review"
                                ? "bg-yellow-100"
                                : notification.type === "stock"
                                ? "bg-red-100"
                                : notification.type === "payment"
                                ? "bg-blue-100"
                                : "bg-gray-100"
                            }`}
                          >
                            {notification.type === "order" && (
                              <ShoppingCart className="h-5 w-5 text-green-600" />
                            )}
                            {notification.type === "review" && (
                              <Star className="h-5 w-5 text-yellow-600" />
                            )}
                            {notification.type === "stock" && (
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            )}
                            {notification.type === "payment" && (
                              <DollarSign className="h-5 w-5 text-blue-600" />
                            )}
                            {notification.type === "system" && (
                              <Bell className="h-5 w-5 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{notification.title}</p>
                              {!notification.read && (
                                <span className="h-2 w-2 bg-blue-500 rounded-full"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-2">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Coupon Dialog */}
      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Discount Coupon</DialogTitle>
            <DialogDescription>
              Create a new discount coupon for your customers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Coupon Code</label>
              <Input
                placeholder="e.g., SUMMER20"
                value={couponForm.code}
                onChange={(e) =>
                  setCouponForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Discount Type</label>
                <Select
                  value={couponForm.discountType}
                  onValueChange={(value: "percentage" | "fixed") =>
                    setCouponForm((prev) => ({ ...prev, discountType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (GHS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Discount Value</label>
                <Input
                  type="number"
                  min={0}
                  value={couponForm.discountValue}
                  onChange={(e) =>
                    setCouponForm((prev) => ({
                      ...prev,
                      discountValue: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Min. Purchase (GHS)</label>
                <Input
                  type="number"
                  min={0}
                  value={couponForm.minPurchase}
                  onChange={(e) =>
                    setCouponForm((prev) => ({
                      ...prev,
                      minPurchase: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Uses</label>
                <Input
                  type="number"
                  min={1}
                  value={couponForm.maxUses}
                  onChange={(e) =>
                    setCouponForm((prev) => ({
                      ...prev,
                      maxUses: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Expiry Date</label>
              <Input
                type="date"
                value={couponForm.expiresAt}
                onChange={(e) =>
                  setCouponForm((prev) => ({ ...prev, expiresAt: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCouponDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCoupon}>Create Coupon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onboarding Dialog */}
      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Welcome to Your Seller Dashboard!
            </DialogTitle>
            <DialogDescription>
              Here's a quick guide to help you get started
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-500" />
                Product Management
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Add, edit, and manage your products. You can mark products as in/out of stock,
                activate or deactivate them, and perform bulk actions.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                Order Tracking
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                View and manage all your orders. Track order status, communicate with buyers,
                and update order progress.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-500" />
                Sales Analytics
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Monitor your sales performance with detailed analytics. Track revenue,
                orders, and customer metrics.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-500" />
                Customer Management
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                View your customer database, track purchase history, and build
                relationships with your buyers.
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-pink-500" />
                Discount Coupons
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Create and manage discount coupons to attract more customers and
                boost your sales.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCompleteOnboarding}>Got it, let's start!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
