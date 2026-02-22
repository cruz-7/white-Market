import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { Button } from "./button";
import { Link } from "react-router-dom";
import { Package, Plus, Eye, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  title: string;
  price: number;
  images?: string[];
  is_active: boolean;
  stock_status?: "in_stock" | "low_stock" | "out_of_stock";
};

interface ProductGridProps {
  products: Product[];
  onProductUpdate: (updatedProducts: Product[]) => void;
}

const ProductGrid = ({ products, onProductUpdate }: ProductGridProps) => {
  const toggleActive = (productId: string, currentlyActive: boolean) => {
    const next = products.map((p) => (p.id === productId ? { ...p, is_active: !currentlyActive } : p));
    onProductUpdate(next);
    toast.success(currentlyActive ? "Product hidden from marketplace" : "Product is now live!");
  };

  const deleteProduct = (productId: string) => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    onProductUpdate(products.filter((p) => p.id !== productId));
    toast.success("Product deleted");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-semibold">My Products</h2>
          <p className="text-xs text-muted-foreground">{products.length} listed • {products.filter((p) => p.is_active).length} active</p>
        </div>
        <Button asChild size="sm" className="gap-1">
          <Link to="/dashboard?sell=1"><Plus className="h-3.5 w-3.5" /> Add Product</Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">You haven't listed any products yet.</p>
            <Button asChild size="sm">
              <Link to="/dashboard?sell=1"><Plus className="h-3.5 w-3.5 mr-1" /> List Your First Product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className={`group relative overflow-hidden transition-all hover:shadow-md ${!p.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-0">
                <div className="aspect-square bg-muted/80 rounded-t-lg flex items-center justify-center overflow-hidden relative">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground/30" />
                  )}
                  {!p.is_active && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                      <Badge variant="outline" className="text-[10px] bg-background">Hidden</Badge>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="icon" variant="secondary" className="h-8 w-8" asChild>
                      <Link to={`/product/${p.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => toggleActive(p.id, p.is_active)}>
                      {p.is_active ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => deleteProduct(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm line-clamp-1">{p.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className="font-display font-bold text-primary text-sm">GHS {p.price}</p>
                    <Badge variant="outline" className={`text-[10px] capitalize ${
                      p.stock_status === "in_stock" ? "border-success/30 text-success" :
                      p.stock_status === "low_stock" ? "border-warning/30 text-warning" :
                      "border-destructive/30 text-destructive"
                    }`}>
                      {p.stock_status?.replace("_", " ") || "in stock"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
