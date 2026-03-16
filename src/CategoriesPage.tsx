import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Package, Search, ShoppingBag, BookOpen, Shirt, Smartphone, Wrench, Sparkles, Home, Dumbbell, Ticket, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { categoriesApi, productsApi, type Category, type Product } from "./api";

// Sample categories data for when API is not available
const SAMPLE_CATEGORIES: Category[] = [
  { id: "1", name: "Clothing & Fashion", slug: "clothing", description: "Student fashion, uniforms, traditional wear", icon: "Shirt", sort_order: 1, is_active: true, product_count: 45 },
  { id: "2", name: "Food & Snacks", slug: "food", description: "Homemade food, snacks, beverages", icon: "Utensils", sort_order: 2, is_active: true, product_count: 78 },
  { id: "3", name: "Electronics & Gadgets", slug: "electronics", description: "Phones, laptops, accessories", icon: "Smartphone", sort_order: 3, is_active: true, product_count: 32 },
  { id: "4", name: "Books & Notes", slug: "books", description: "Textbooks, lecture notes, past questions", icon: "BookOpen", sort_order: 4, is_active: true, product_count: 156 },
  { id: "5", name: "Services", slug: "services", description: "Tutoring, printing, errands, repairs", icon: "Wrench", sort_order: 5, is_active: true, product_count: 23 },
  { id: "6", name: "Beauty & Health", slug: "beauty", description: "Skincare, haircare, wellness products", icon: "Sparkles", sort_order: 6, is_active: true, product_count: 67 },
  { id: "7", name: "Housing & Rooms", slug: "housing", description: "Hostel rooms, apartments, sublets", icon: "Home", sort_order: 7, is_active: true, product_count: 18 },
  { id: "8", name: "Sports & Fitness", slug: "sports", description: "Gym equipment, sports gear", icon: "Dumbbell", sort_order: 8, is_active: true, product_count: 29 },
  { id: "9", name: "Events & Tickets", slug: "events", description: "Event tickets, party supplies", icon: "Ticket", sort_order: 9, is_active: true, product_count: 41 },
  { id: "10", name: "Other", slug: "other", description: "Miscellaneous items", icon: "Package", sort_order: 10, is_active: true, product_count: 12 },
];

const iconMap: Record<string, React.ReactNode> = {
  Shirt: <Shirt className="h-8 w-8" />,
  Utensils: <span className="text-2xl">🍔</span>,
  Smartphone: <Smartphone className="h-8 w-8" />,
  BookOpen: <BookOpen className="h-8 w-8" />,
  Wrench: <Wrench className="h-8 w-8" />,
  Sparkles: <Sparkles className="h-8 w-8" />,
  Home: <Home className="h-8 w-8" />,
  Dumbbell: <Dumbbell className="h-8 w-8" />,
  Ticket: <Ticket className="h-8 w-8" />,
  Package: <Package className="h-8 w-8" />,
};

export default function CategoriesPage() {
  const { slug } = useParams<{ slug?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [useSampleData, setUseSampleData] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (slug && categories.length > 0) {
      const category = categories.find((c) => c.slug === slug);
      if (category) {
        setSelectedCategory(category);
        loadCategoryProducts(category.id);
      }
    } else if (!slug) {
      setSelectedCategory(null);
      setProducts([]);
    }
  }, [slug, categories]);

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await categoriesApi.getAll();
    
    if (error || !data || data.length === 0) {
      // Use sample data if API fails
      console.log("Using sample categories data");
      setCategories(SAMPLE_CATEGORIES);
      setUseSampleData(true);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const loadCategoryProducts = async (categoryId: string) => {
    setProductsLoading(true);
    const { data, error } = await productsApi.getAll();
    
    if (error) {
      toast.error("Failed to load products");
      setProducts([]);
    } else {
      // Filter by category - in real app, API would filter by category_id
      const filtered = (data || []).filter((p: any) => p.category_id === categoryId);
      setProducts(filtered);
    }
    setProductsLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      if (selectedCategory) {
        loadCategoryProducts(selectedCategory.id);
      }
      return;
    }
    
    setProductsLoading(true);
    const { data, error } = await productsApi.getAll(searchQuery);
    if (error) {
      toast.error(error);
    } else {
      let filtered = data || [];
      if (selectedCategory) {
        filtered = filtered.filter((p: any) => p.category_id === selectedCategory.id);
      }
      setProducts(filtered);
    }
    setProductsLoading(false);
  };

  // Show products for selected category
  if (selectedCategory) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-6">
            <Link to="/categories" className="text-primary hover:underline font-medium">
              Categories
            </Link>
            <span className="text-gray-400">›</span>
            <span className="font-medium text-gray-700">{selectedCategory.name}</span>
          </div>

          {/* Category Header */}
          <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm border">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center text-white">
                {iconMap[selectedCategory.icon || "Package"] || <Package className="h-8 w-8" />}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{selectedCategory.name}</h1>
                <p className="text-gray-500 mt-1">{selectedCategory.description}</p>
                <Badge variant="secondary" className="mt-2">
                  {selectedCategory.product_count || 0} products
                </Badge>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder={`Search in ${selectedCategory.name}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 h-12"
              />
            </div>
            <Button onClick={handleSearch} className="h-12 px-6">
              Search
            </Button>
          </div>

          {productsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border">
              <Package className="h-20 w-20 mx-auto text-gray-200 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No products found</h2>
              <p className="text-gray-500 mb-6">
                Be the first to list in this category!
              </p>
              <Link to="/add-product">
                <Button className="bg-primary hover:bg-primary/90">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((product) => (
                <Link key={product.id} to={`/product/${product.id}`}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0">
                    <div className="aspect-square relative overflow-hidden bg-gray-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Package className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-sm truncate">{product.title}</h3>
                      <p className="text-primary font-bold mt-1">
                        GHS {product.price?.toFixed(2) || "0.00"}
                      </p>
                      {product.users?.full_name && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          by {product.users.full_name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show all categories
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Browse Categories
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Find exactly what you need from our verified student sellers
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {useSampleData && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-center text-amber-800 text-sm">
                ⚠️ Database not connected - showing sample data
              </div>
            )}
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {categories.map((category) => (
                <Link key={category.id} to={`/categories/${category.slug}`}>
                  <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer h-full border-0 shadow-sm">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mb-4 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                        <div className="text-primary">
                          {iconMap[category.icon || "Package"] || <Package className="h-8 w-8" />}
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">{category.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                        {category.description}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {category.product_count || 0} items
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Popular Categories Highlight */}
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Star className="h-6 w-6 text-amber-500" />
                Popular on Campus
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-amber-600" />
                      Books & Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Textbooks, lecture notes, and past questions from seniors
                    </p>
                    <Link to="/categories/books">
                      <Button variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100">
                        Browse Books
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shirt className="h-5 w-5 text-green-600" />
                      Fashion
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Student fashion, uniforms, and traditional wear
                    </p>
                    <Link to="/categories/clothing">
                      <Button variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-100">
                        Browse Fashion
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-purple-600" />
                      Services
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Tutoring, printing, errands, and repairs
                    </p>
                    <Link to="/categories/services">
                      <Button variant="outline" className="w-full border-purple-300 text-purple-700 hover:bg-purple-100">
                        Browse Services
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
