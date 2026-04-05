import { Link, useNavigate } from "react-router-dom";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, Check, Package } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Checkbox } from "./checkbox";
import { useCart } from "./CartContext";
import { toast } from "sonner";

export default function CartPage() {
  const navigate = useNavigate();
  const {
    items,
    removeItem,
    updateQuantity,
    toggleSelect,
    selectAll,
    deselectAll,
    selectedIds,
    clearCart,
    getTotal,
    getSelectedTotal,
    getSelectedCount,
    itemCount,
  } = useCart();

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  const handleCheckout = () => {
    const selectedItems = items.filter(item => selectedIds.has(item.productId));
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to checkout");
      return;
    }
    // Navigate to checkout with selected items
    navigate(`/checkout?cart=${Array.from(selectedIds).join(",")}`);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/marketplace">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
          </div>

          {/* Empty State */}
          <Card className="max-w-md mx-auto">
            <CardContent className="p-12 text-center">
              <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-12 h-12 text-rose-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
              <p className="text-gray-500 mb-6">
                Looks like you haven't added anything to your cart yet.
              </p>
              <Link to="/marketplace">
                <Button className="bg-rose-500 hover:bg-rose-600">
                  Start Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/marketplace">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Shopping Cart ({itemCount})
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={clearCart}>
            Clear All
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Select All */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={allSelected ? deselectAll : selectAll}
                    className="flex items-center gap-3"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      allSelected || someSelected
                        ? "bg-rose-500 border-rose-500"
                        : "border-gray-300"
                    }`}>
                      {(allSelected || someSelected) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="font-medium text-gray-700">
                      {allSelected ? "Deselect All" : "Select All"}
                    </span>
                  </button>
                  <span className="text-sm text-gray-500">
                    {selectedIds.size} of {items.length} selected
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            {items.map((item) => (
              <Card key={item.id} className={`overflow-hidden transition-all ${
                selectedIds.has(item.productId) ? "ring-2 ring-rose-500" : ""
              }`}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(item.productId)}
                      className="flex-shrink-0 mt-2"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedIds.has(item.productId)
                          ? "bg-rose-500 border-rose-500"
                          : "border-gray-300"
                      }`}>
                        {selectedIds.has(item.productId) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </button>

                    {/* Product Image */}
                    <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">
                        by {item.sellerName}
                      </p>
                      <p className="font-bold text-lg text-rose-600">
                        ₵{item.price.toFixed(2)}
                      </p>
                    </div>

                    {/* Quantity & Remove */}
                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="p-1 rounded bg-gray-100 hover:bg-gray-200"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({getSelectedCount()} items)</span>
                  <span>₵{getSelectedTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Other items</span>
                  <span>₵{(getTotal() - getSelectedTotal()).toFixed(2)}</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-rose-600">₵{getSelectedTotal().toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  className="w-full bg-rose-500 hover:bg-rose-600 py-3 text-lg font-semibold"
                  onClick={handleCheckout}
                  disabled={selectedIds.size === 0}
                >
                  Proceed to Checkout ({getSelectedCount()})
                </Button>
                {selectedIds.size === 0 && (
                  <p className="text-center text-sm text-gray-500">
                    Select items to proceed
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}