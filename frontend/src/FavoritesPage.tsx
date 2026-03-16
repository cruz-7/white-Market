import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Loader2, Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { favoritesApi, type Favorite } from "./api";
import { timeAgo } from "./data";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setLoading(true);
    const { data, error } = await favoritesApi.getAll();
    if (error) {
      toast.error(error);
    } else {
      setFavorites(data?.favorites || []);
    }
    setLoading(false);
  };

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    const { error } = await favoritesApi.remove(productId);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Removed from favorites");
      setFavorites((prev) => prev.filter((f) => f.product_id !== productId));
    }
    setRemovingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="h-8 w-8 text-red-500 fill-red-500" />
        <h1 className="text-2xl font-bold">My Favorites</h1>
        <Badge variant="secondary">{favorites.length} items</Badge>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No favorites yet</h2>
          <p className="text-gray-500 mb-6">
            Start adding items to your favorites to see them here
          </p>
          <Link to="/">
            <Button>Browse Products</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favorites.map((favorite) => (
            <Card key={favorite.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <Link to={`/product/${favorite.product_id}`}>
                <div className="aspect-square relative overflow-hidden bg-gray-100">
                  {favorite.product?.image_url ? (
                    <img
                      src={favorite.product.image_url}
                      alt={favorite.product.title}
                      className="object-cover w-full h-full hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No Image
                    </div>
                  )}
                </div>
              </Link>
              <CardContent className="p-4">
                <Link to={`/product/${favorite.product_id}`}>
                  <h3 className="font-semibold truncate hover:text-primary transition-colors">
                    {favorite.product?.title || "Product"}
                  </h3>
                </Link>
                <p className="text-lg font-bold text-primary mt-1">
                  GHS {favorite.product?.price?.toFixed(2) || "0.00"}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">
                    Added {timeAgo(favorite.created_at)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemove(favorite.product_id)}
                    disabled={removingId === favorite.product_id}
                  >
                    {removingId === favorite.product_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                </div>
                <Link to={`/product/${favorite.product_id}`} className="block mt-3">
                  <Button className="w-full" size="sm">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buy Now
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}