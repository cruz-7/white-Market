import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Star, MapPin, Calendar, MessageCircle, ShoppingBag, ShieldCheck, Loader2 } from "lucide-react";

import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { productsApi, type Product } from "./api";

function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [seller, setSeller] = useState<{ full_name?: string; email?: string; role?: string; created_at?: string } | null>(null);

  useEffect(() => {
    if (!id) {
      toast.error("Seller not found");
      navigate("/marketplace");
      return;
    }

    const fetchSellerData = async () => {
      setLoading(true);
      
      try {
        // Fetch seller's products
        const productsRes = await productsApi.getBySeller(id);
        if (productsRes.data) {
          setProducts(productsRes.data);
        }

        // Try to get seller info from products
        if (productsRes.data && productsRes.data.length > 0) {
          setSeller(productsRes.data[0].users as any);
        }
      } catch (error) {
        console.error("Error fetching seller:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSellerData();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-slate-600">Loading seller profile...</p>
        </div>
      </div>
    );
  }

  if (!seller && products.length === 0) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
        <div className="container py-8">
          <button 
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800 mb-4"
            onClick={() => navigate("/marketplace")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace
          </button>
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-bold text-slate-900">Seller Not Found</h2>
              <p className="mt-2 text-slate-600">This seller doesn't exist or has no products listed.</p>
              <Button asChild className="mt-4">
                <Link to="/marketplace">Browse Products</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const sellerName = seller?.full_name || "Unknown Seller";
  const sellerInitial = sellerName.charAt(0).toUpperCase();
  const joinDate = seller?.created_at ? new Date(seller.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Unknown";
  const isVerified = seller?.role === "seller" || seller?.role === "admin";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      {/* Header */}
      <div className="border-b bg-white/85 shadow-sm backdrop-blur-md">
        <div className="container py-3">
          <button 
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      </div>

      <div className="container py-8">
        {/* Seller Profile Card */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* Avatar */}
              <div className="flex justify-center sm:justify-start">
                <Avatar className="h-24 w-24 border-4 border-primary/10">
                  <AvatarImage src={seller?.email ? `https://api.dicebear.com/7.x/initials/svg?seed=${sellerName}` : undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {sellerInitial}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{sellerName}</h1>
                  {isVerified && (
                    <Badge className="w-fit bg-emerald-100 text-emerald-700 border-emerald-200">
                      <ShieldCheck className="mr-1 h-3 w-3" /> Verified Seller
                    </Badge>
                  )}
                </div>
                
                <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 sm:justify-start">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> Joined {joinDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="h-4 w-4" /> {products.length} products
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-500" /> New Seller
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => {
                    // Would open a conversation
                    toast.info("Start a conversation from a product page");
                  }}>
                    <MessageCircle className="mr-2 h-4 w-4" /> Contact Seller
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/marketplace">Browse More</Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Products from {sellerName}
          </h2>
          
          {products.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShoppingBag className="h-12 w-12 text-slate-300 mx-auto" />
                <p className="mt-2 text-slate-600">No products listed yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <img
                    src={product.image_url || "https://via.placeholder.com/640x360?text=White+Market"}
                    alt={product.title}
                    className="h-44 w-full object-cover"
                  />
                  <CardContent className="space-y-2 p-4">
                    <h3 className="font-semibold text-slate-900 line-clamp-1">{product.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {product.description || "No description provided"}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-primary">
                        GHS {Number(product.price || 0).toFixed(2)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {product.category || "General"}
                      </Badge>
                    </div>
                    <Button 
                      className="w-full" 
                      size="sm"
                      asChild
                    >
                      <Link to={`/product/${product.id}`}>View Details</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SellerProfile;
