import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "wm_user_interactions";

export type UserInteraction = {
  viewedProducts: string[];
  viewedCategories: string[];
  purchasedProducts: string[];
  lastUpdated: string;
};

const defaultInteractions: UserInteraction = {
  viewedProducts: [],
  viewedCategories: [],
  purchasedProducts: [],
  lastUpdated: new Date().toISOString(),
};

export function useRecommendations() {
  const [interactions, setInteractions] = useState<UserInteraction>(defaultInteractions);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setInteractions(JSON.parse(stored));
      } catch {
        setInteractions(defaultInteractions);
      }
    }
  }, []);

  const saveInteractions = useCallback((newInteractions: UserInteraction) => {
    const updated = { ...newInteractions, lastUpdated: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setInteractions(updated);
  }, []);

  const trackProductView = useCallback((productId: string, category?: string) => {
    setInteractions((prev) => {
      const viewedProducts = prev.viewedProducts.includes(productId)
        ? prev.viewedProducts
        : [productId, ...prev.viewedProducts].slice(0, 20);
      
      const viewedCategories = category && !prev.viewedCategories.includes(category)
        ? [...prev.viewedCategories, category]
        : prev.viewedCategories;

      const updated = { ...prev, viewedProducts, viewedCategories };
      saveInteractions(updated);
      return updated;
    });
  }, [saveInteractions]);

  const trackPurchase = useCallback((productId: string) => {
    setInteractions((prev) => {
      const purchasedProducts = prev.purchasedProducts.includes(productId)
        ? prev.purchasedProducts
        : [productId, ...prev.purchasedProducts].slice(0, 10);

      const updated = { ...prev, purchasedProducts };
      saveInteractions(updated);
      return updated;
    });
  }, [saveInteractions]);

  const getCategoryPreferences = useCallback(() => {
    const categoryCounts: Record<string, number> = {};
    interactions.viewedCategories.forEach((cat) => {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
  }, [interactions.viewedCategories]);

  const getRecentlyViewed = useCallback(() => {
    return interactions.viewedProducts.slice(0, 6);
  }, [interactions.viewedProducts]);

  return {
    interactions,
    trackProductView,
    trackPurchase,
    getCategoryPreferences,
    getRecentlyViewed,
  };
}

export default useRecommendations;