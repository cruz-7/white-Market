import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Search, ShoppingBag, BookOpen, Shirt, Smartphone, Wrench, Sparkles, Home, Dumbbell, Ticket, Star, Clock, User, GraduationCap, Printer, Scissors, Truck, Phone, Hammer, Users, Calendar, Award, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import {
  categoriesApi,
  productsApi,
  servicesApi,
  type Category,
  type Product,
  type Service,
} from "./api";

// Service types for the services page
const SERVICE_TYPES = [
  { id: "tutoring", name: "Tutoring", icon: GraduationCap, color: "from-blue-500 to-blue-600" },
  { id: "printing", name: "Printing & Copy", icon: Printer, color: "from-green-500 to-green-600" },
  { id: "hairdressing", name: "Hairdressing", icon: Scissors, color: "from-pink-500 to-pink-600" },
  { id: "errands", name: "Errands", icon: Truck, color: "from-orange-500 to-orange-600" },
  { id: "phone_repair", name: "Phone Repair", icon: Phone, color: "from-purple-500 to-purple-600" },
  { id: "general_repair", name: "General Repairs", icon: Hammer, color: "from-gray-500 to-gray-600" },
];

// Sample categories data for when API is not available
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
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [serviceListings, setServiceListings] = useState<Service[]>([]);
  const [serviceTypeCounts, setServiceTypeCounts] = useState<Map<string, number>>(new Map());
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceLoadError, setServiceLoadError] = useState<string | null>(null);
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (slug && categories.length > 0) {
      const category = categories.find((c) => c.slug === slug);
      if (category) {
        setSelectedCategory(category);
        loadCategoryProducts(category.id);
        if (category.slug === "services") void loadServices();
      }
    } else if (!slug) {
      setSelectedCategory(null);
      setProducts([]);
    }
  }, [slug, categories]);

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await categoriesApi.getAll();
    
    if (error) toast.error(`Could not load categories: ${error}`);
    setCategories(data ?? []);
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

  const loadServices = async () => {
    setServicesLoading(true);
    setServiceLoadError(null);
    const [listResult, typeResult] = await Promise.all([
      servicesApi.getAll(undefined, 100, 0, "newest"),
      servicesApi.getTypes(),
    ]);
    if (listResult.error || typeResult.error) {
      const error = listResult.error || typeResult.error || "Could not load services.";
      setServiceLoadError(error);
      setServiceListings([]);
      setServiceTypeCounts(new Map());
    } else {
      setServiceListings(listResult.data?.services ?? []);
      setServiceTypeCounts(new Map((typeResult.data ?? []).map(({ id, count }) => [id, count ?? 0])));
    }
    setServicesLoading(false);
  };

  const submitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bookingService) return;
    setBookingLoading(true);
    const { error } = await servicesApi.createBooking(bookingService.id, {
      scheduled_date: bookingDate,
      scheduled_time: bookingTime,
      notes: bookingNotes.trim(),
    });
    setBookingLoading(false);
    if (error) {
      toast.error(error);
      if (/sign in|authenticated|unauthorized/i.test(error)) {
        navigate("/auth?role=user");
      }
      return;
    }
    toast.success("Service request sent");
    setBookingService(null);
    setBookingDate("");
    setBookingTime("");
    setBookingNotes("");
  };

  // Special rendering for Services category
  if (selectedCategory?.slug === "services") {
    const filteredProviders = serviceListings.filter(
      (service) => !selectedService || service.service_type === selectedService
    );
    const totalServiceCount = [...serviceTypeCounts.values()].reduce((total, count) => total + count, 0);
    const averageServiceRating = serviceListings.length
      ? serviceListings.reduce((total, service) => total + service.rating, 0) / serviceListings.length
      : 0;
    const dynamicServiceTypes = [...serviceTypeCounts.keys()]
      .filter((id) => !SERVICE_TYPES.some((service) => service.id === id))
      .map((id) => ({
        id,
        name: id.replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
        icon: Package,
        color: "from-gray-500 to-gray-600",
      }));
    
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
                    <span className="text-purple-100">{totalServiceCount} Active Services</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-400" />
                    <span className="text-purple-100">{averageServiceRating.toFixed(1)} Avg Rating</span>
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
              {[...SERVICE_TYPES, ...dynamicServiceTypes].map((service) => {
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
                    <p className={`text-xs ${isSelected ? 'text-purple-100' : 'text-gray-500'}`}>{serviceTypeCounts.get(service.id) ?? 0} services</p>
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
            
            {servicesLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>
            ) : serviceLoadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center" role="alert">
                <p className="mb-3 text-sm text-red-700">{serviceLoadError}</p>
                <Button variant="outline" onClick={() => void loadServices()}>Retry</Button>
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="rounded-xl border bg-white p-8 text-center">
                <h3 className="font-semibold text-gray-800">No services listed yet</h3>
                <p className="mt-1 text-sm text-gray-500">Try another service type or check back later.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProviders.map((service) => {
                  const providerName = service.provider?.full_name || "Student provider";
                  const avatarUrl = service.provider?.avatar_url;
                  return (
                    <Card key={service.id} className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={providerName} className="w-16 h-16 rounded-full object-cover border-2 border-purple-100" />
                          ) : (
                            <div className="w-16 h-16 rounded-full border-2 border-purple-100 bg-purple-50 flex items-center justify-center text-purple-700 font-semibold">
                              {providerName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 truncate">{service.title}</h3>
                              {service.is_verified && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" aria-label="Verified service" />}
                            </div>
                            <p className="text-sm text-gray-500 truncate">{providerName}</p>
                            <p className="text-sm text-purple-600 font-medium">
                              GHS {service.price.toFixed(2)}{service.price_type === "hourly" ? "/hr" : service.price_type === "starting_from" ? "+" : ""}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                {service.rating.toFixed(1)} ({service.review_count})
                              </span>
                              {service.location && <span className="truncate">{service.location}</span>}
                            </div>
                          </div>
                        </div>
                        {service.description && <p className="mt-3 text-sm text-gray-600 line-clamp-2">{service.description}</p>}
                        <div className="mt-4 flex gap-2">
                          <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => navigate(`/seller/${service.user_id}`)}>
                            View Profile
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 border-purple-200 text-purple-600 hover:bg-purple-50"
                            onClick={() => setBookingService(service)}
                          >
                            Request Service
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-12 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-200">
            <div className="text-center">
              <Award className="h-12 w-12 mx-auto text-amber-500 mb-3" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Offer a Service?</h3>
              <p className="text-gray-600 mb-4 max-w-lg mx-auto">
                Have a skill to share? Join our network of student service providers and start earning today.
              </p>
              <Button className="bg-amber-500 hover:bg-amber-600" onClick={() => navigate("/auth?tab=signup&role=seller")}>
                Start Offering Services
              </Button>
            </div>
          </div>
        </div>
        {bookingService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={() => setBookingService(null)}>
            <form
              className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-booking-title"
              onClick={(event) => event.stopPropagation()}
              onSubmit={submitBooking}
            >
              <div>
                <h2 id="service-booking-title" className="text-lg font-bold text-gray-900">Request {bookingService.title}</h2>
                <p className="mt-1 text-sm text-gray-500">Choose a time and send a request to the provider.</p>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Date
                <input type="date" required min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Time
                <input type="time" required value={bookingTime} onChange={(event) => setBookingTime(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Notes
                <textarea value={bookingNotes} onChange={(event) => setBookingNotes(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setBookingService(null)} disabled={bookingLoading}>Cancel</Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={bookingLoading}>
                  {bookingLoading ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </form>
          </div>
        )}
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
              <Link to={`/add-product?from=${encodeURIComponent(location.pathname)}`}>
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
            {categories.length === 0 && (
              <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
                Categories are not available right now. Please try again shortly.
              </div>
            )}

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
