import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { Button } from "./button";
import { Badge } from "./badge";
import { CheckCircle, Star, Shield, ArrowRight, Search, ShoppingBag, MessageSquare, Wallet, Users, Zap, Award, Camera, TrendingUp, Store, Flame } from "lucide-react";
import { Card, CardContent } from "./card";
import { Avatar, AvatarFallback } from "./avatar";
import { Input } from "./input";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { categoriesApi, feedbackApi, sellerApi } from "./api";
import FeedbackPopup from "./FeedbackPopup";
import ImageSearchModal from "./ImageSearchModal";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

const CATEGORY_ICONS: Record<string, string> = {
  clothing: "👕",
  food: "🍲",
  electronics: "📱",
  books: "📚",
  services: "🛠️",
  beauty: "💄",
  housing: "🏠",
  sports: "🏋️",
  events: "🎟️",
  other: "📦",
};

const STEPS = [
  { icon: Users, title: "Sign Up & Verify", desc: "Create your account with your UG email. Upload your student ID to get verified." },
  { icon: Store, title: "Set Up Shop or Browse", desc: "List your products with photos and prices, or browse what fellow students are selling." },
  { icon: MessageSquare, title: "Connect & Agree", desc: "Chat with the seller, agree on price and a campus meetup spot before you buy." },
  { icon: Wallet, title: "Pay & Handover", desc: "Pay via Mobile Money, then meet on campus for a quick handover." },
];

const CAMPUS_TRENDING_TOPICS = [
  { label: "Sneakers", search: "sneakers" },
  { label: "Perfumes", search: "perfume" },
  { label: "Food", search: "food" },
  { label: "Thrift Clothes", search: "thrift clothes" },
  { label: "Gadgets", search: "gadgets" },
];

const Index = () => {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loadingTestimonials, setLoadingTestimonials] = useState(true);
  const [featuredSellers, setFeaturedSellers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const trendingProducts = useQuery(api.functions.products.trending, { limit: 4 });

  useEffect(() => {
    const fetchCategories = async () => {
      const result = await categoriesApi.getAll();
      if (result.error) {
        console.error("Failed to fetch categories:", result.error);
        toast.error(`Could not load categories: ${result.error}`);
        return;
      }
      setCategories(result.data ?? []);
    };

    const fetchTestimonials = async () => {
      try {
        const res = await feedbackApi.getTestimonials(3);
        if (res.error) throw new Error(res.error);
        setTestimonials(res.data?.testimonials ?? []);
      } catch (error) {
        console.error("Failed to fetch testimonials:", error);
        toast.error("Could not load student feedback.");
      } finally {
        setLoadingTestimonials(false);
      }
    };

    const fetchFeaturedSellers = async () => {
      try {
        const res = await sellerApi.getTopSellers(3);
        if (res.error) throw new Error(res.error);
        setFeaturedSellers(res.data?.sellers ?? []);
      } catch (error) {
        console.error("Failed to fetch featured sellers:", error);
        toast.error("Could not load student shops.");
      }
    };

    void fetchCategories();
    fetchTestimonials();
    fetchFeaturedSellers();
  }, []);
  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-light via-background to-orange-light">
        <div className="container py-16 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
              <Shield className="mr-1 h-3 w-3" /> Verified UG Students Only
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Buy from Students.{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Sell to Students.
              </span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto">
              The trusted marketplace built for University of Ghana students. Discover products from student businesses, buy safely, and support your campus community.
            </p>

            {/* Search bar */}
            <div className="mt-8 max-w-xl mx-auto">
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for products, sellers..."
                    className="pl-9 h-12 text-base"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value;
                        if (val) navigate(`/marketplace?search=${encodeURIComponent(val)}`);
                      }
                    }}
                  />
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-12 w-12 border-accent text-accent hover:bg-accent hover:text-accent-foreground relative group"
                  title="Search by image - Upload a photo to find similar products"
                  onClick={() => setShowImageSearch(true)}
                >
                  <Camera className="h-5 w-5" />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Visual Search
                  </div>
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                💡 Try our <button onClick={() => setShowImageSearch(true)} className="text-accent hover:underline">visual search</button> - upload an image to find similar products!
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="text-xs text-muted-foreground">Popular:</span>
                {CAMPUS_TRENDING_TOPICS.map((topic) => (
                  <button
                    key={topic.label}
                    onClick={() => navigate(`/marketplace?search=${encodeURIComponent(topic.search)}`)}
                    className="text-xs bg-accent/10 text-accent hover:bg-accent/20 px-2 py-1 rounded-full transition-colors"
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="gap-2 text-base">
                <Link to="/auth?tab=signup&role=seller">
                  <Store className="h-5 w-5" /> Start Selling
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 text-base border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                <Link to="/marketplace">
                  <ShoppingBag className="h-5 w-5" /> Browse Products
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-primary" /> ID Verified</span>
              <span className="flex items-center gap-1"><Star className="h-4 w-4 text-accent" /> Rated & Reviewed</span>
              <span className="flex items-center gap-1"><Shield className="h-4 w-4 text-primary" /> Safe Payments</span>
            </div>
          </div>
        </div>
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />
      </section>

      {/* Categories */}
      <section className="container py-16">
        <h2 className="font-display text-2xl font-bold text-center mb-2">Shop by Category</h2>
        <p className="text-center text-muted-foreground mb-8">Find exactly what you need from fellow students</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((cat) => (
            <Link to={`/marketplace?category=${encodeURIComponent(cat.name)}`} key={cat.name}>
              <Card className="cursor-pointer text-center shadow-sm transition-all hover:border-primary/30 hover:shadow-md group">
                <CardContent className="p-4">
                  <span className="text-3xl block mb-2">{CATEGORY_ICONS[cat.slug] || "📦"}</span>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground">{cat.product_count || 0} items</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {categories.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              No categories are available right now.
            </p>
          )}
        </div>
      </section>

      {/* Campus Trending */}
      <section className="container pb-8">
        <Card className="border-orange-200 bg-orange-50/60 shadow-sm">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
                  <Flame className="h-4 w-4" /> Trending Now
                </p>
                <h2 className="font-display text-2xl font-bold text-slate-900">🔥 Trending in Legon</h2>
                <p className="text-sm text-slate-600">Students are browsing these categories the most this week.</p>
              </div>
              <Button asChild variant="outline" className="border-orange-300 text-orange-800 hover:bg-orange-100">
                <Link to="/marketplace">See all listings</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {CAMPUS_TRENDING_TOPICS.map((topic) => (
                <Link
                  key={topic.label}
                  to={`/marketplace?search=${encodeURIComponent(topic.search)}`}
                  className="rounded-full border border-orange-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-orange-400 hover:text-orange-800"
                >
                  {topic.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Trending Products */}
      <section className="bg-muted/50 py-16">
        <div className="container">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            <h2 className="font-display text-2xl font-bold text-center">Trending Products This Week</h2>
          </div>
          <p className="text-center text-muted-foreground mb-8">Popular picks from student sellers this week</p>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            {trendingProducts?.length ? trendingProducts.slice(0, 4).map((p: any, i: number) => (
              <Link key={p.id || i} to={`/product/${p.id}`} className="block">
              <Card className="cursor-pointer shadow-sm transition-shadow hover:shadow-md group">
                <CardContent className="p-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} className="aspect-square w-full object-cover rounded-t-lg" />
                  ) : (
                    <div className="aspect-square bg-muted/80 rounded-t-lg flex items-center justify-center">
                      <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">{p.users?.full_name || "Student Seller"}</p>
                    <p className="font-display font-bold text-primary mt-1">GHS {p.price}</p>
                  </div>
                </CardContent>
              </Card>
              </Link>
            )) : (
              <p className="col-span-full rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
                {trendingProducts === undefined
                  ? "Loading live listings..."
                  : "No products have been listed yet. Be the first to sell on campus."}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container py-16">
        <h2 className="font-display text-2xl font-bold text-center mb-2">How It Works</h2>
        <p className="text-center text-muted-foreground mb-10">Four simple steps to start buying or selling</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <step.icon className="h-7 w-7" />
              </div>
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                {i + 1}
              </span>
              <h3 className="font-display font-semibold mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top Sellers */}
      <section className="bg-gradient-to-br from-primary/5 to-accent/5 py-16">
        <div className="container">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="h-5 w-5 text-accent" />
            <h2 className="font-display text-2xl font-bold text-center">Featured Student Shops</h2>
          </div>
          <p className="text-center text-muted-foreground mb-10">Top-rated student businesses on campus</p>
          <div className="grid gap-6 md:grid-cols-3 max-w-3xl mx-auto">
            {featuredSellers.length > 0 ? featuredSellers.map((h: any, i: number) => (
              <Link key={h.id} to={`/seller/${h.id}`} className="block">
              <Card className="text-center shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="relative inline-block mb-3">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                        {h.seller_display_name?.split(" ").map((n: string) => n[0]).join("") || h.full_name?.split(" ").map((n: string) => n[0]).join("") || "SS"}
                      </AvatarFallback>
                    </Avatar>
                    {i === 0 && (
                      <Award className="absolute -top-1 -right-1 h-6 w-6 text-accent fill-accent/20" />
                    )}
                  </div>
                  <Badge variant="outline" className="mb-2 border-primary/30 text-primary">
                    <CheckCircle className="mr-1 h-3 w-3" /> Verified Seller
                  </Badge>
                  <h3 className="font-display font-semibold">{h.seller_display_name || h.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{h.products_count || 0} products</p>
                  <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-accent">
                      <Star className="h-3.5 w-3.5 fill-accent" /> {h.avg_rating?.toFixed(1) || "New"}
                    </span>
                    <span className="text-muted-foreground">• {h.orders_count || 0} sales</span>
                  </div>
                </CardContent>
              </Card>
              </Link>
            )) : (
              <p className="col-span-full rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
                Student shops will appear here after sellers list products.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container py-16">
        <h2 className="font-display text-2xl font-bold text-center mb-2">What Students Say</h2>
        <p className="text-center text-muted-foreground mb-10">Real feedback from the Legon community</p>
        {loadingTestimonials ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div>
                      <div className="h-4 w-24 bg-muted rounded mb-2" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="h-16 bg-muted rounded mb-3" />
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-4 w-4 bg-muted rounded" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          testimonials.length > 0 ? <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.id || t.name} className="shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {t.full_name?.split(" ").map((n: string) => n[0]).join("") || t.avatar || t.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{t.full_name || t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.department || t.dept || "UG Student"}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">"{t.feedback_text || t.text}"</p>
                  <div className="flex gap-0.5 mt-3">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < (t.rating || 5) ? "fill-accent text-accent" : "text-muted"}`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div> : (
            <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
              Student feedback will appear here as the marketplace grows.
            </p>
          )
        )}
      </section>

      {/* CTA */}
      <section className="container py-16">
        <Card className="bg-gradient-to-r from-primary to-teal-dark text-primary-foreground overflow-hidden relative">
          <CardContent className="p-8 md:p-12 text-center relative z-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">Ready to Start Your Campus Business?</h2>
            <p className="text-primary-foreground/80 mb-6 max-w-lg mx-auto">
              Join hundreds of UG students already buying and selling on campus. Set up your shop in minutes.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="bg-accent hover:bg-orange-dark text-accent-foreground gap-2">
                <Link to="/auth?tab=signup">
                  Join White Market <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-accent/10 to-transparent" />
        </Card>
      </section>

      <FeedbackPopup />
      <Footer />

      {/* Image Search Modal */}
      <ImageSearchModal
        isOpen={showImageSearch}
        onClose={() => setShowImageSearch(false)}
      />
    </div>
  );
};

export default Index;
