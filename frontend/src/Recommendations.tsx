import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useRef } from "react";
import { Product, getProducts } from "./data";
import { Card, CardContent } from "./card";
import { Button } from "./button";
import { Link } from "react-router-dom";
import { Star, Clock3, ShoppingCart } from "lucide-react";

interface RecommendationsProps {
  title?: string;
  subtitle?: string;
  excludeIds?: string[];
  limit?: number;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (id: string) => void;
}

function RecommendationCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card className="overflow-hidden min-w-[200px] max-w-[200px] shrink-0 group">
      <div className="relative">
        <img 
          src={product.image} 
          alt={product.title} 
          className="h-32 w-full object-cover transition-transform group-hover:scale-105" 
        />
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-1 text-xs font-semibold text-white">
            <Sparkles className="h-3 w-3" />
            For You
          </span>
        </div>
      </div>
      <CardContent className="space-y-1 p-3">
        <p className="line-clamp-1 text-sm font-semibold">{product.title}</p>
        <p className="text-xs text-slate-500">by {product.sellerName}</p>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          <span>{product.rating > 0 ? product.rating.toFixed(1) : "N/A"}</span>
          <span className="text-slate-400">({product.reviews > 0 ? product.reviews : "0"})</span>
        </div>
        <div className="flex items-center justify-between">
          <p className="font-bold text-primary">GHS {product.price.toFixed(2)}</p>
        </div>
        <Button 
          size="sm" 
          className="w-full mt-1"
          onClick={() => onAddToCart(product.id)}
        >
          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </CardContent>
    </Card>
  );
}

export function Recommendations({ 
  title = "Recommended For You", 
  subtitle = "Based on your browsing history",
  excludeIds = [],
  limit = 6
}: RecommendationsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const allProducts = getProducts().filter((p) => p.is_active);
  
  const recommendations = allProducts
    .filter((p) => !excludeIds.includes(p.id))
    .slice(0, limit);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 220;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
          </h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {recommendations.map((product) => (
          <Link key={product.id} to={`/product/${product.id}`}>
            <RecommendationCard 
              product={product} 
              onAddToCart={() => {}}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SimilarProducts({ 
  currentProductId, 
  category, 
  limit = 4 
}: { 
  currentProductId: string; 
  category?: string; 
  limit?: number;
}) {
  const allProducts = getProducts().filter((p) => p.is_active);
  
  const similar = allProducts
    .filter((p) => p.id !== currentProductId && p.category === category)
    .slice(0, limit);

  if (similar.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-700">Similar Products</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {similar.map((product) => (
          <Link key={product.id} to={`/product/${product.id}`}>
            <Card className="overflow-hidden hover:shadow-md transition-shadow">
              <img 
                src={product.image} 
                alt={product.title} 
                className="h-24 w-full object-cover" 
              />
              <CardContent className="p-2">
                <p className="line-clamp-1 text-xs font-medium">{product.title}</p>
                <p className="text-sm font-bold text-primary">GHS {product.price.toFixed(2)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Recommendations;