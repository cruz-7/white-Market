import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  productId: string;
  title: string;
  price: number;
  image: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  addedAt: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: { id: string; title: string; price: number; image: string; sellerId: string; sellerName: string }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  toggleSelect: (productId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectedIds: Set<string>;
  clearCart: () => void;
  getTotal: () => number;
  getSelectedTotal: () => number;
  getSelectedCount: () => number;
  itemCount: number;
}

const CART_STORAGE_KEY = "wm_cart";
const SELECTED_KEY = "wm_cart_selected";

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    const savedSelected = localStorage.getItem(SELECTED_KEY);
    
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Error loading cart:", e);
      }
    }
    
    if (savedSelected) {
      try {
        setSelectedIds(new Set(JSON.parse(savedSelected)));
      } catch (e) {
        console.error("Error loading selected:", e);
      }
    }
  }, []);

  // Save to localStorage when items change
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(Array.from(selectedIds)));
  }, [selectedIds]);

  const addItem = (product: { id: string; title: string; price: number; image: string; sellerId: string; sellerName: string }) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        toast.info("Item already in cart");
        return prev;
      }
      
      const newItem: CartItem = {
        id: `cart_${Date.now()}`,
        productId: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        sellerId: product.sellerId,
        sellerName: product.sellerName,
        quantity: 1,
        addedAt: new Date().toISOString(),
      };
      
      toast.success(`${product.title} added to cart`);
      return [...prev, newItem];
    });
    
    // Auto-select the newly added item
    setSelectedIds((prev) => new Set([...prev, product.id]));
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const toggleSelect = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map((item) => item.productId)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const clearCart = () => {
    setItems([]);
    setSelectedIds(new Set());
  };

  const getTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getSelectedTotal = () => {
    return items
      .filter((item) => selectedIds.has(item.productId))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getSelectedCount = () => {
    return items.filter((item) => selectedIds.has(item.productId)).length;
  };

  const value: CartContextType = {
    items,
    addItem,
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
    itemCount: items.length,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}