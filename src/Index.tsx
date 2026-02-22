import { Link, useNavigate } from "react-router-dom";
import { Button } from "./button";
import { Badge } from "./badge";
import { CheckCircle, Star, Shield, ArrowRight, Search, ShoppingBag, MessageSquare, Wallet, Users, Zap, Award, Camera, TrendingUp, Store } from "lucide-react";
import { Card, CardContent } from "./card";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Input } from "./input";
import Navbar from "./Navbar";
import Footer from "./Footer";

const CATEGORIES = [
  { name: "Food", icon: "🍲", count: 64 },
  { name: "Clothing", icon: "👕", count: 52 },
  { name: "Beauty", icon: "💄", count: 38 },
  { name: "Accessories", icon: "👜", count: 45 },
  { name: "Electronics", icon: "📱", count: 22 },
  { name: "Stationery", icon: "📚", count: 31 },
  { name: "Custom Items", icon: "🎨", count: 27 },
  { name: "Other", icon: "📦", count: 19 },
];

const STEPS = [
  { icon: Users, title: "Sign Up & Verify", desc: "Create your account with your UG email. Upload your student ID to get verified." },
  { icon: Store, title: "Set Up Shop or Browse", desc: "List your products with photos and prices, or browse what fellow students are selling." },
  { icon: MessageSquare, title: "Connect & Agree", desc: "Chat with the seller, agree on price and delivery before you buy." },
  { icon: Wallet, title: "Pay & Receive", desc: "Pay via Mobile Money. Pickup on campus or arrange delivery." },
];

const TESTIMONIALS = [
  { name: "Ama K.", dept: "Business Admin, L300", text: "I sell homemade snacks on White Market and made GHS 1,200 last month! Way better than posting on WhatsApp status.", avatar: "AK" },
  { name: "Kwame M.", dept: "Engineering, L200", text: "Found exactly the laptop charger I needed from a verified student. Fast, safe, and cheaper than the shops outside campus!", avatar: "KM" },
  { name: "Abena F.", dept: "Nursing, L400", text: "The verified badge gives me confidence. I know I'm dealing with real UG students, not random people.", avatar: "AF" },
];

const TOP_SELLERS = [
  { name: "Nana's Kitchen", skill: "Food & Snacks", rating: 4.9, sales: 127, avatar: "NK" },
  { name: "Ama Collections", skill: "Clothing & Fashion", rating: 4.8, sales: 89, avatar: "AC" },
  { name: "TechBro UG", skill: "Electronics & Gadgets", rating: 4.9, sales: 64, avatar: "TB" },
];

const TRENDING = [
  { title: "Homemade Jollof Rice (per plate)", price: 25, seller: "Nana's Kitchen", image: null },
  { title: "Custom Beaded Bracelets", price: 15, seller: "Ama Beads", image: null },
  { title: "Laptop Stand (Adjustable)", price: 85, seller: "TechBro UG", image: null },
  { title: "Shea Butter Body Cream", price: 30, seller: "Glow By Efua", image: null },
];

const Index = () => {
  const navigate = useNavigate();
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
                        if (val) window.location.href = `/marketplace?search=${encodeURIComponent(val)}`;
                      }
                    }}
                  />
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-12 w-12 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                  title="Search by image"
                  onClick={() => navigate("/marketplace?imageSearch=true")}
                >
                  <Camera className="h-5 w-5" />
                </Button>
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
          {CATEGORIES.map((cat) => (
            <Link to={`/marketplace?category=${encodeURIComponent(cat.name)}`} key={cat.name}>
              <Card className="cursor-pointer text-center shadow-sm transition-all hover:border-primary/30 hover:shadow-md group">
                <CardContent className="p-4">
                  <span className="text-3xl block mb-2">{cat.icon}</span>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground">{cat.count} items</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending Products */}
      <section className="bg-muted/50 py-16">
        <div className="container">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            <h2 className="font-display text-2xl font-bold text-center">Trending Products</h2>
          </div>
          <p className="text-center text-muted-foreground mb-8">Popular picks from student sellers this week</p>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            {TRENDING.map((p, i) => (
              <Card key={i} className="cursor-pointer shadow-sm transition-shadow hover:shadow-md group">
                <CardContent className="p-0">
                  <div className="aspect-square bg-muted/80 rounded-t-lg flex items-center justify-center">
                    <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">{p.seller}</p>
                    <p className="font-display font-bold text-primary mt-1">GHS {p.price}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
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
            {TOP_SELLERS.map((h, i) => (
              <Card key={h.name} className="text-center shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="relative inline-block mb-3">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{h.avatar}</AvatarFallback>
                    </Avatar>
                    {i === 0 && (
                      <Award className="absolute -top-1 -right-1 h-6 w-6 text-accent fill-accent/20" />
                    )}
                  </div>
                  <Badge variant="outline" className="mb-2 border-primary/30 text-primary">
                    <CheckCircle className="mr-1 h-3 w-3" /> Verified Seller
                  </Badge>
                  <h3 className="font-display font-semibold">{h.name}</h3>
                  <p className="text-sm text-muted-foreground">{h.skill}</p>
                  <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-accent">
                      <Star className="h-3.5 w-3.5 fill-accent" /> {h.rating}
                    </span>
                    <span className="text-muted-foreground">• {h.sales} sales</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container py-16">
        <h2 className="font-display text-2xl font-bold text-center mb-2">What Students Say</h2>
        <p className="text-center text-muted-foreground mb-10">Real feedback from the Legon community</p>
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{t.avatar}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.dept}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
                <div className="flex gap-0.5 mt-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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

      <Footer />
    </div>
  );
};

export default Index;
