import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Star,
  BarChart3,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  Clock,
  Grid,
  List,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Tag,
  Archive,
  Copy,
  Share2,
  Heart,
  MessageSquare,
} from "lucide-react";
import { QuickEditProduct } from "./QuickEditProduct";
import { productsApi } from "./api";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Badge } from "./badge";
import { Input } from "./input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
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
import { Progress } from "./progress";
import { cn } from "./lib/utils";

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  category_id?: string;
  category?: string;
  image_url?: string;
  is_active?: boolean;
  stock_quantity?: number;
  created_at?: string;
  updated_at?: string;
  view_count?: number;
  sales_count?: number;
  rating?: number;
  review_count?: number;
  is_featured?: boolean;
  tags?: string[];
}

interface ProductAnalytics {
  totalViews: number;
  totalSales: number;
  totalRevenue: number;
  averageRating: number;
  conversionRate: number;
  topPerforming: Product[];
  lowStock: Product[];
  inactive: Product[];
}

interface EnhancedProductManagementProps {
  products: Product[];
  onToggleStock: (productId: string, isActive: boolean) => void;
  onDeleteProduct: (productId: string) => void;
  onBulkAction: (action: string, productIds: string[]) => void;
  onRefresh: () => void;
}

export function EnhancedProductManagement({
  products,
  onToggleStock,
  onDeleteProduct,
  onBulkAction,
  onRefresh,
}: EnhancedProductManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "price_high" | "price_low" | "popular" | "rating">("newest");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "low_stock">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);

  // Calculate analytics
  const analytics: ProductAnalytics = useMemo(() => {
    const activeProducts = products.filter((p) => p.is_active === true);
    const totalViews = products.reduce((sum, p) => sum + (p.view_count || 0), 0);
    const totalSales = products.reduce((sum, p) => sum + (p.sales_count || 0), 0);
    const totalRevenue = products.reduce((sum, p) => sum + (p.price * (p.sales_count || 0)), 0);
    const averageRating = products.length > 0
      ? products.reduce((sum, p) => sum + (p.rating || 0), 0) / products.length
      : 0;
    const conversionRate = totalViews > 0 ? (totalSales / totalViews) * 100 : 0;

    const topPerforming = [...products]
      .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))
      .slice(0, 5);

    const lowStock = products.filter((p) => p.stock_quantity !== undefined && p.stock_quantity < 5);
    const inactive = products.filter((p) => p.is_active === false);

    return {
      totalViews,
      totalSales,
      totalRevenue,
      averageRating,
      conversionRate,
      topPerforming,
      lowStock,
      inactive,
    };
  }, [products]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category || "uncategorized"));
    return ["all", ...Array.from(cats)];
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          (p.category && p.category.toLowerCase().includes(query)) ||
          (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (filterStatus === "active") {
      result = result.filter((p) => p.is_active);
    } else if (filterStatus === "inactive") {
      result = result.filter((p) => !p.is_active);
    } else if (filterStatus === "low_stock") {
      result = result.filter((p) => p.stock_quantity !== undefined && p.stock_quantity < 5);
    }

    // Apply category filter
    if (filterCategory !== "all") {
      result = result.filter((p) => p.category === filterCategory);
    }

    // Apply sorting
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        break;
      case "price_high":
        result.sort((a, b) => b.price - a.price);
        break;
      case "price_low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "popular":
        result.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
        break;
      case "rating":
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }

    return result;
  }, [products, searchQuery, filterStatus, filterCategory, sortBy]);

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleBulkAction = (action: string) => {
    if (selectedProducts.length === 0) return;
    onBulkAction(action, selectedProducts);
    setSelectedProducts([]);
  };

  const handleSaveQuickEdit = async (productId: string, updates: Partial<Product>) => {
    try {
      const { error } = await productsApi.update(productId, updates);
      if (error) throw new Error(error);
      toast.success("Product updated successfully!");
      onRefresh();
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
      throw error;
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      const { data, error } = await productsApi.create({
        title: `${product.title} (Copy)`,
        description: product.description,
        price: product.price,
        category_id: product.category_id,
        image_url: product.image_url,
      });
      if (error) throw new Error(error);
      toast.success("Product duplicated successfully!");
      onRefresh();
    } catch (error) {
      console.error("Error duplicating product:", error);
      toast.error("Failed to duplicate product");
    }
  };

  const handleShareProduct = async (product: Product) => {
    const productUrl = `${window.location.origin}/product/${product.id}`;
    try {
      await navigator.clipboard.writeText(productUrl);
      toast.success("Product link copied to clipboard!");
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = productUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Product link copied to clipboard!");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    const productName = product?.title || "this product";
    
    if (!window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const { error } = await productsApi.delete(productId);
      if (error) throw new Error(error);
      toast.success("Product deleted successfully!");
      onRefresh();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    }
  };

  const getStatusBadge = (product: Product) => {
    if (product.is_active === false) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Inactive</Badge>;
    }
    if (product.stock_quantity !== undefined && product.stock_quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (product.stock_quantity !== undefined && product.stock_quantity < 5) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Low Stock</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-700">Active</Badge>;
  };

  const getPerformanceIndicator = (product: Product) => {
    const sales = product.sales_count || 0;
    const views = product.view_count || 0;
    const conversion = views > 0 ? (sales / views) * 100 : 0;

    if (conversion > 5) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (conversion > 2) {
      return <TrendingUp className="w-4 h-4 text-yellow-500" />;
    } else if (sales === 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-xs text-muted-foreground">
                  {products.filter((p) => p.is_active).length} active
                </p>
              </div>
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.conversionRate.toFixed(1)}% conversion
                </p>
              </div>
              <Eye className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{analytics.totalSales}</p>
                <p className="text-xs text-muted-foreground">
                  GHS {analytics.totalRevenue.toFixed(2)} revenue
                </p>
              </div>
              <ShoppingCart className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold">{analytics.averageRating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  across {products.filter((p) => p.review_count).length} products
                </p>
              </div>
              <Star className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(analytics.lowStock.length > 0 || analytics.inactive.length > 0) && (
        <div className="flex gap-4">
          {analytics.lowStock.length > 0 && (
            <Card className="flex-1 border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">Low Stock Alert</p>
                    <p className="text-sm text-yellow-700">
                      {analytics.lowStock.length} product{analytics.lowStock.length > 1 ? "s" : ""} running low
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {analytics.inactive.length > 0 && (
            <Card className="flex-1 border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800">Inactive Products</p>
                    <p className="text-sm text-blue-700">
                      {analytics.inactive.length} product{analytics.inactive.length > 1 ? "s" : ""} not listed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Product Management Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Product Management</CardTitle>
              <CardDescription>Add, edit, and manage your products</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button asChild>
                <Link to="/add-product">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                  {showFilters ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </Button>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="price_high">Price: High to Low</SelectItem>
                    <SelectItem value="price_low">Price: Low to High</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-r-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-l-none"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="low_stock">Low Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Category:</span>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat === "all" ? "All Categories" : cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Bulk Actions */}
            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredProducts.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                    title="Select all products"
                  />
                  <span className="text-sm font-medium">
                    {selectedProducts.length} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleBulkAction("activate")}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkAction("deactivate")}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Deactivate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkAction("feature")}>
                    <Star className="h-4 w-4 mr-1" />
                    Feature
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction("delete")}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Products List/Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No products found</p>
              <Button asChild className="mt-4">
                <Link to="/add-product">Add Your First Product</Link>
              </Button>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={cn(
                    "flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors",
                    expandedProduct === product.id && "ring-2 ring-primary"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => handleSelectProduct(product.id)}
                    className="h-4 w-4 rounded border-gray-300"
                    title={`Select ${product.title}`}
                  />
                  <div className="relative">
                    <img
                      src={product.image_url || "/placeholder.svg"}
                      alt={product.title}
                      className="h-16 w-16 object-cover rounded-lg"
                    />
                    {product.is_featured && (
                      <div className="absolute -top-1 -right-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{product.title}</h3>
                      {getStatusBadge(product)}
                      {getPerformanceIndicator(product)}
                    </div>
                    <p className="text-sm text-gray-500">{product.category}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-sm font-medium text-green-600">
                        GHS {Number(product.price).toFixed(2)}
                      </p>
                      {product.stock_quantity !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Stock: {product.stock_quantity}
                        </p>
                      )}
                      {product.view_count !== undefined && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {product.view_count}
                        </p>
                      )}
                      {product.sales_count !== undefined && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3" />
                          {product.sales_count}
                        </p>
                      )}
                      {product.rating !== undefined && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          {product.rating > 0 ? product.rating.toFixed(1) : "N/A"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleStock(product.id, !product.is_active)}
                    >
                      {product.is_active ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/product/${product.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setQuickEditProduct(product)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Quick Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShareProduct(product)}>
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <div className="relative">
                    <img
                      src={product.image_url || "/placeholder.svg"}
                      alt={product.title}
                      className="w-full h-48 object-cover"
                    />
                    {product.is_featured && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-yellow-400 text-yellow-900">
                          <Star className="w-3 h-3 mr-1" />
                          Featured
                        </Badge>
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      {getStatusBadge(product)}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium truncate flex-1">{product.title}</h3>
                      {getPerformanceIndicator(product)}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-lg font-bold text-green-600">
                        GHS {Number(product.price).toFixed(2)}
                      </p>
                      {product.rating !== undefined && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-medium">{product.rating > 0 ? product.rating.toFixed(1) : "N/A"}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      {product.stock_quantity !== undefined && (
                        <span>Stock: {product.stock_quantity}</span>
                      )}
                      {product.view_count !== undefined && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {product.view_count}
                        </span>
                      )}
                      {product.sales_count !== undefined && (
                        <span className="flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3" />
                          {product.sales_count}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link to={`/edit-product/${product.id}`}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleStock(product.id, !product.is_active)}
                      >
                        {product.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Edit Modal */}
      {quickEditProduct && (
        <QuickEditProduct
          product={quickEditProduct}
          onSave={handleSaveQuickEdit}
          onClose={() => setQuickEditProduct(null)}
        />
      )}
    </div>
  );
}
