import { useState } from "react";
import {
  X,
  Save,
  Package,
  DollarSign,
  Hash,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";

import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { cn } from "./lib/utils";

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  category?: string;
  image_url?: string;
  is_active?: boolean;
  stock_quantity?: number;
  created_at?: string;
}

interface QuickEditProductProps {
  product: Product;
  onSave: (productId: string, updates: Partial<Product>) => Promise<void>;
  onClose: () => void;
}

export function QuickEditProduct({ product, onSave, onClose }: QuickEditProductProps) {
  const [title, setTitle] = useState(product.title);
  const [price, setPrice] = useState(product.price.toString());
  const [stockQuantity, setStockQuantity] = useState(
    product.stock_quantity?.toString() || "0"
  );
  const [isActive, setIsActive] = useState(product.is_active ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(product.id, {
        title: title.trim(),
        price: Number.parseFloat(price),
        stock_quantity: Number.parseInt(stockQuantity, 10),
        is_active: isActive,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getStockStatus = () => {
    const qty = Number.parseInt(stockQuantity, 10);
    if (qty === 0) return { label: "Out of Stock", color: "bg-red-100 text-red-700", icon: XCircle };
    if (qty < 5) return { label: "Low Stock", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle };
    return { label: "In Stock", color: "bg-green-100 text-green-700", icon: CheckCircle };
  };

  const stockStatus = getStockStatus();
  const StockIcon = stockStatus.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6 md:p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Success Animation */}
        {showSuccess && (
          <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center z-10 rounded-2xl">
            <div className="text-center text-white animate-bounce">
              <Sparkles className="w-16 h-16 mx-auto mb-4" />
              <p className="text-2xl font-bold">Saved!</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-300" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg truncate max-w-[200px]">
                  {product.title}
                </h3>
                <p className="text-sm text-muted-foreground">{product.category}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Rename Product */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Product Name
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter product name"
              className="text-lg"
            />
            {title.trim() !== product.title && (
              <p className="text-xs text-muted-foreground">
                Changed from "{product.title}"
              </p>
            )}
          </div>

          {/* Status Toggle */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Product Status</label>
            <div className="flex gap-3">
              <button
                onClick={() => setIsActive(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
                  isActive
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <Eye className="w-5 h-5" />
                <span className="font-medium">Active</span>
                {isActive && <CheckCircle className="w-4 h-4 ml-auto" />}
              </button>
              <button
                onClick={() => setIsActive(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
                  !isActive
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <EyeOff className="w-5 h-5" />
                <span className="font-medium">Inactive</span>
                {!isActive && <XCircle className="w-4 h-4 ml-auto" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isActive
                ? "✓ Product is visible to buyers on the marketplace"
                : "✗ Product is hidden from the marketplace"}
            </p>
          </div>

          {/* Price */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Price (GHS)
            </label>
            <div className="relative">
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="text-lg font-semibold pl-8"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ₵
              </span>
            </div>
            {Number.parseFloat(price) !== product.price && (
              <div className="flex items-center gap-2 text-sm">
                {Number.parseFloat(price) > product.price ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className="text-muted-foreground">
                  Changed from GHS {product.price.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Stock Quantity */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Stock Quantity
            </label>
            <div className="flex gap-3">
              <Input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="0"
                min="0"
                className="flex-1"
              />
              <Badge className={cn("px-3 py-2", stockStatus.color)}>
                <StockIcon className="w-4 h-4 mr-1" />
                {stockStatus.label}
              </Badge>
            </div>
            <div className="flex gap-2">
              {[0, 5, 10, 25, 50, 100].map((qty) => (
                <button
                  key={qty}
                  onClick={() => setStockQuantity(qty.toString())}
                  className={cn(
                    "px-3 py-1 text-sm rounded-lg border transition-colors",
                    stockQuantity === qty.toString()
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  {qty}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/50 rounded-xl">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {product.stock_quantity || 0}
              </p>
              <p className="text-xs text-muted-foreground">Current Stock</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                GHS {product.price.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Current Price</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {product.is_active ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-muted-foreground">Status</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-gray-50 border-t flex gap-2 sm:gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
