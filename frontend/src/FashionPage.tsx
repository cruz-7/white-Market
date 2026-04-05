import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Sparkles, TrendingUp, Star, Heart, ShoppingBag, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { productsApi, favoritesApi, likesApi } from "./api";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { useCart } from "./CartContext";

interface FashionProduct {
  id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  seller_id?: string;
  created_at?: string;
}

const CATEGORIES = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "tops", label: "Tops", emoji: "👕" },
  { id: "bottoms", label: "Bottoms", emoji: "👖" },
  { id: "dresses", label: "Dresses", emoji: "👗" },
  { id: "shoes", label: "Shoes", emoji: "👟" },
  { id: "accessories", label: "Accessories", emoji: "👜" },
];

const TRENDING_STYLES = [
  "Streetwear",
  "Vintage",
  "Casual",
  "Office Chic",
  "Athleisure",
  "Boho",
];

export default function FashionPage() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [items, setItems] = useState<FashionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [likedProducts, setLikedProducts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchFashionItems = async () => {
      setLoading(true);
      try {
        const result = await productsApi.getAll({ limit: 50 });
        if (result.data) {
          setItems(result.data as FashionProduct[]);
          // Get real like counts from products
          const likes: Record<string, number> = {};
          (result.data as FashionProduct[]).forEach((item: any) => {
            likes[item.id] = item.like_count || 0;
          });
          setLikedProducts(likes);
        }
      } catch (error) {
        console.error("Error fetching fashion items:", error);
        toast.error("Failed to load fashion items");
      } finally {
        setLoading(false);
      }
    };
    
    const fetchFavorites = async () => {
      try {
        const { data, error } = await favoritesApi.getAll();
        if (error) {
          console.log("Favorites error:", error);
          return;
        }
        if (data?.favorites) {
          setFavoriteIds(new Set(data.favorites.map(f => f.product_id)));
        }
      } catch (error) {
        console.log("Error fetching favorites:", error);
      }
    };
    
    fetchFashionItems();
    fetchFavorites();
  }, []);

  const handleToggleFavorite = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    const isFavorited = favoriteIds.has(productId);
    const isLiked = likedProducts[productId] > 0;
    
    try {
      if (isFavorited) {
        const result = await favoritesApi.remove(productId);
        if (result.error) {
          toast.error(`Error: ${result.error}`);
          console.error("Remove favorite error:", result.error);
          return;
        }
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        toast.success("Removed from favorites");
      } else {
        const result = await favoritesApi.add(productId);
        if (result.error) {
          toast.error(`Error: ${result.error}`);
          console.error("Add favorite error:", result.error);
          return;
        }
        setFavoriteIds(prev => new Set(prev).add(productId));
        toast.success("Added to favorites!");
      }

      // Also handle the like count via API
      if (isLiked) {
        const unlikeResult = await likesApi.unlike(productId);
        if (!unlikeResult.error) {
          setLikedProducts(prev => ({
            ...prev,
            [productId]: Math.max(0, unlikeResult.data?.like_count || 0)
          }));
        }
      } else {
        const likeResult = await likesApi.like(productId);
        if (!likeResult.error) {
          setLikedProducts(prev => ({
            ...prev,
            [productId]: likeResult.data?.like_count || 1
          }));
        }
      }
    } catch (error) {
      console.error("Error toggling favorite/like:", error);
      toast.error("Failed to update");
    }
  };

  const handleAddToCart = (e: React.MouseEvent, product: FashionProduct) => {
    e.stopPropagation();
    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image_url || "",
      sellerId: product.seller_id || "",
      sellerName: "Seller",
    });
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeCategory === "all") return matchesSearch;
    
    const categoryMatch = item.category?.toLowerCase().includes(activeCategory) ||
      item.title?.toLowerCase().includes(activeCategory);
    
    return matchesSearch && categoryMatch;
  });

  const getCategoryEmoji = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("shirt") || t.includes("top") || t.includes("blouse")) return "👕";
    if (t.includes("pant") || t.includes("jean") || t.includes("trouser")) return "👖";
    if (t.includes("dress") || t.includes("skirt")) return "👗";
    if (t.includes("shoe") || t.includes("sneaker") || t.includes("boot")) return "👟";
    if (t.includes("bag") || t.includes("watch") || t.includes("hat") || t.includes("belt")) return "👜";
    return "👗";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-rose-500 mx-auto mb-4" />
          <p className="text-rose-400 font-medium">Loading fashion treasures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-amber-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-rose-500 via-fuchsia-500 to-rose-400 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-rose-200" />
            <span className="text-rose-100 font-medium">Campus Fashion Hub</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            Express Your<br />Style
          </h1>
          <p className="text-rose-100 text-lg md:text-xl max-w-xl mb-8">
            Discover unique fashion pieces from students on campus. 
            Stand out with trendy looks that won't break the bank.
          </p>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            <Button 
              onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-rose-500 hover:bg-rose-50 px-6 md:px-8 py-2.5 md:py-3 font-semibold rounded-full text-sm md:text-base w-full md:w-auto"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Shop Now
            </Button>
            <Button 
              variant="outline" 
              className="border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:border-white/50 px-6 md:px-8 py-2.5 md:py-3 rounded-full text-sm md:text-base w-full md:w-auto font-semibold"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Trending
            </Button>
          </div>
        </div>
        
        {/* Wave Decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#fdf2f8"/>
          </svg>
        </div>
      </div>

      {/* Trending Styles */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-rose-500" />
          <h2 className="font-bold text-gray-800">Trending Styles</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {TRENDING_STYLES.map((style) => (
            <button
              key={style}
              className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-600 hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-gray-100"
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div id="shop" className="container mx-auto px-4 pb-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Shop by Category</h2>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
        
        <div className="hidden md:flex flex-wrap gap-3 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all ${
                activeCategory === cat.id
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                  : "bg-white text-gray-600 hover:bg-rose-50 border border-gray-200"
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Mobile Category Pills */}
        <div className="md:hidden overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? "bg-rose-500 text-white"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                <span>{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search for clothes, shoes, accessories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-100 bg-white focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition-all text-gray-700 placeholder-gray-400 shadow-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Results Count */}
        <p className="text-gray-500 mb-4">
          Showing <span className="font-semibold text-rose-500">{filteredItems.length}</span> items
          {searchQuery && <span> for "<span className="font-semibold">{searchQuery}</span>"</span>}
        </p>

        {/* Product Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl shadow-sm">
            <div className="text-6xl mb-4">👗</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No items found</h3>
            <p className="text-gray-500">Try adjusting your search or browse different categories</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {filteredItems.map((item, index) => (
              <Card 
                key={item.id}
                className="group cursor-pointer overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                onClick={() => navigate(`/product/${item.id}`)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">
                      {getCategoryEmoji(item.title || "")}
                    </div>
                  )}
                  
                  {/* Quick Actions Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button 
                      className={`p-3 rounded-full shadow-lg transition-colors ${
                        favoriteIds.has(item.id) 
                          ? "bg-rose-500 text-white" 
                          : "bg-white text-rose-500 hover:bg-rose-50"
                      }`}
                      onClick={(e) => handleToggleFavorite(e, item.id)}
                    >
                      <Heart className={`w-5 h-5 ${favoriteIds.has(item.id) ? "fill-current" : ""}`} />
                    </button>
                    <button 
                      className="p-3 bg-white rounded-full shadow-lg hover:bg-rose-50 transition-colors"
                      onClick={(e) => handleAddToCart(e, item)}
                    >
                      <ShoppingBag className="w-5 h-5 text-rose-500" />
                    </button>
                  </div>

                  {/* Like Count */}
                  {likedProducts[item.id] > 0 && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
                      <Heart className="w-3 h-3 text-rose-500 fill-current" />
                      <span className="text-xs font-medium text-gray-700">{likedProducts[item.id]}</span>
                    </div>
                  )}

                  {/* Category Badge */}
                  <Badge className="absolute top-3 left-3 bg-white/90 text-gray-700 hover:bg-white">
                    {getCategoryEmoji(item.title || "")} {item.category || "Fashion"}
                  </Badge>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1 group-hover:text-rose-500 transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-lg text-rose-600">
                      ₵{Number(item.price || 0).toFixed(2)}
                    </p>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="text-xs font-medium">4.5</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer Banner */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-violet-500 to-purple-500 rounded-3xl p-6 md:p-10 text-white text-center relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full"></div>
          <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-white/10 rounded-full"></div>
          
          <div className="relative z-10">
            <h3 className="text-xl md:text-3xl font-bold mb-2 md:mb-3">Sell Your Fashion</h3>
            <p className="text-purple-100 mb-5 md:mb-6 text-sm md:text-base max-w-md mx-auto">Have clothes you don't wear? List them and earn money!</p>
            <Button 
              onClick={() => navigate("/dashboard?sell=1")}
              className="bg-white text-purple-600 hover:bg-purple-50 px-5 md:px-8 py-2.5 md:py-3 font-semibold rounded-full text-sm md:text-base w-full md:w-auto transition-all hover:scale-105 active:scale-95"
            >
              Start Selling
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
