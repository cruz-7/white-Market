import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { productsApi } from "./api";
import ProductGrid from "./ProductGrid";

export default function FashionPage() {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchFashionItems = async () => {
      setLoading(true);
      try {
        const result = await productsApi.getAll(
          categoryParam ? { category_id: categoryParam } : undefined
        );
        
        if (result.data) {
          setItems(result.data);
        }
      } catch (error) {
        console.error("Error fetching fashion items:", error);
        toast.error("Failed to load fashion items");
      } finally {
        setLoading(false);
      }
    };
    fetchFashionItems();
  }, [categoryParam]);

  const filteredItems = items.filter(item =>
    item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Fashion</h1>
        <p className="text-muted-foreground">Browse trendy fashion items from students</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search fashion items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No fashion items found</p>
        </div>
      ) : (
        <ProductGrid products={filteredItems} />
      )}
    </div>
  );
}
