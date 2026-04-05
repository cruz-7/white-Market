import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Search, ShoppingBag, BookOpen, Shirt, Smartphone, Wrench, Sparkles, Home, Dumbbell, Ticket, Star, Clock, User, GraduationCap, Printer, Scissors, Truck, Phone, Hammer, Users, Calendar, Award, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { categoriesApi, productsApi, type Category, type Product } from "./api";

// Service types for the services page
const SERVICE_TYPES = [
  { id: "tutoring", name: "Tutoring", icon: GraduationCap, description: "Academic tutoring for various courses", color: "from-blue-500 to-blue-600", providers: 12 },
  { id: "printing", name: "Printing & Copy", icon: Printer, description: "Printing, photocopying, binding", color: "from-green-500 to-green-600", providers: 8 },
  { id: "hairdressing", name: "Hairdressing", icon: Scissors, description: "Braiding, haircuts, styling", color: "from-pink-500 to-pink-600", providers: 15 },
  { id: "errands", name: "Errands", icon: Truck, description: "Pickup, delivery, campus runs", color: "from-orange-500 to-orange-600", providers: 20 },
  { id: "phone_repair", name: "Phone Repair", icon: Phone, description: "Screen replacement, fixes", color: "from-purple-500 to-purple-600", providers: 5 },
  { id: "general_repair", name: "General Repairs", icon: Hammer, description: "Electronics, accessories repair", color: "from-gray-500 to-gray-600", providers: 7 },
];

// Sample service providers for demo
const SAMPLE_PROVIDERS = [
  { id: "1", name: "Ama Kowalski", service: "tutoring", rating: 4.9, reviews: 45, price: "GHS 30/hr", responseTime: "< 1 hour", verified: true, image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop" },
  { id: "2", name: "Kofi Mensah", service: "printing", rating: 4.7, reviews: 28, price: "GHS 0.50/page", responseTime: "< 2 hours", verified: true, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop" },
  { id: "3", name: "Abena Serwaa", service: "hairdressing", rating: 5.0, reviews: 62, price: "GHS 50+", responseTime: "< 3 hours", verified: true, image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop" },
  { id: "4", name: "Yaw Osei", service: "errands", rating: 4.8, reviews: 89, price: "GHS 10/task", responseTime: "< 30 min", verified: true, image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop" },
  { id: "5", name: "Nana Kofi", service: "phone_repair", rating: 4.6, reviews: 34, price: "GHS 80+", responseTime: "< 4 hours", verified: true, image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop" },
  { id: "6", name: "Efua Brown", service: "tutoring", rating: 4.9, reviews: 51, price: "GHS 25/hr", responseTime: "< 2 hours", verified: true, image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop" },
];

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
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [useSampleData, setUseSampleData] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

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
    const { data, error } = await productsApi.getAll({ category_id: categoryId, is_active: true });
    
    if (error) {
      // Fallback: fetch all and filter client-side
      const { data: allProducts } = await productsApi.getAll();
      const filtered = (allProducts || []).filter((p: any) => p.category_id === categoryId);
      setProducts(filtered);
    } else {
      setProducts(data || []);
    }
    setProductsLoading(false);
  };

  const handleSearch = async () => {
    setProductsLoading(true);
    
    const params: any = { is_active: true };
    if (searchQuery.trim()) {
      params.q = searchQuery.trim();
    }
    if (selectedCategory) {
      params.category_id = selectedCategory.id;
    }
    
    const { data, error } = await productsApi.getAll(params);
    
    if (error) {
      toast.error("Failed to search products");
    } else {
      setProducts(data || []);
    }
    setProductsLoading(false);
  };

  // Special rendering for Services category
  if (selectedCategory?.slug === "services") {
    const filteredProviders = selectedService 
      ? SAMPLE_PROVIDERS.filter(p => p.service === selectedService)
      : SAMPLE_PROVIDERS;
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-6">
            <Link to="/categories" className="text-primary hover:underline font-medium">
              Categories
            </Link>
            <span className="text-gray-400">›</span>
            <span className="font-medium text-gray-700">Services</span>
          </div>

          {/* Services Hero */}
          <div className="bg-gradient-to-r from-purple-600 to-violet-600 rounded-3xl p-8 mb-8 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">Campus Services</h1>
                <p className="text-purple-100 text-lg">Find trusted student service providers on campus</p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <span className="text-purple-100">67 Active Providers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-400" />
                    <span className="text-purple-100">4.8 Avg Rating</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
                <p className="text-3xl font-bold">Need a service?</p>
                <p className="text-purple-100 text-sm mt-1">List your skills and earn</p>
                <Button className="mt-4 bg-white text-purple-600 hover:bg-purple-50" onClick={() => navigate("/profile-setup")}>
                  Become a Provider
                </Button>
              </div>
            </div>
          </div>

          {/* Service Types */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Browse by Service Type</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {SERVICE_TYPES.map((service) => {
                const Icon = service.icon;
                const isSelected = selectedService === service.id;
                return (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(isSelected ? null : service.id)}
                    className={`p-4 rounded-xl text-left transition-all duration-300 ${
                      isSelected 
                        ? `bg-gradient-to-br ${service.color} text-white shadow-lg scale-105` 
                        : 'bg-white border border-gray-200 hover:border-purple-300 hover:shadow-md'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                      isSelected ? 'bg-white/20' : `bg-gradient-to-br ${service.color} text-white`
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-800'}`}>{service.name}</p>
                    <p className={`text-xs ${isSelected ? 'text-purple-100' : 'text-gray-500'}`}>{service.providers} providers</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Providers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedService 
                  ? SERVICE_TYPES.find(s => s.id === selectedService)?.name + " Providers"
                  : "All Service Providers"
                }
              </h2>
              <p className="text-gray-500">{filteredProviders.length} results</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProviders.map((provider) => (
                <Card key={provider.id} className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <img 
                        src={provider.image} 
                        alt={provider.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-purple-100"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 truncate">{provider.name}</h3>
                          {provider.verified && (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-purple-600 font-medium">{provider.price}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                            {provider.rating} ({provider.reviews})
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {provider.responseTime}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button 
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                        onClick={() => navigate(`/seller/${provider.id}`)}
                      >
                        View Profile
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 border-purple-200 text-purple-600 hover:bg-purple-50"
                        onClick={() => navigate('/messages')}
                      >
                        Message
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-200">
            <div className="text-center">
              <Award className="h-12 w-12 mx-auto text-amber-500 mb-3" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Offer a Service?</h3>
              <p className="text-gray-600 mb-4 max-w-lg mx-auto">
                Have a skill to share? Join our network of student service providers and start earning today.
              </p>
              <Button 
                className="bg-amber-500 hover:bg-amber-600"
                onClick={() => navigate("/profile-setup")}
              >
                Start Offering Services
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                    <Link to="/books-and-notes">
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
                    <Link to="/fashion">
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
