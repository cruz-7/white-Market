import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Star, 
  Calendar, 
  MessageCircle, 
  ShoppingBag, 
  ShieldCheck, 
  Loader2,
  MapPin,
  Clock,
  TrendingUp,
  Award,
  Heart,
  Share2,
  ExternalLink,
  Package,
  Zap,
  Users,
  CheckCircle2,
  Sparkles,
  Edit3,
  Camera,
  Save,
  X,
  AlertCircle
} from "lucide-react";

import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { productsApi, sellerApi, ratingsApi, type Product } from "./api";
import { supabase } from "./supabase-client";
import { SellerRatingStats } from "./SellerRatingStats";

function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [seller, setSeller] = useState<{ 
    full_name?: string; 
    email?: string; 
    role?: string; 
    created_at?: string;
    verified?: boolean;
    avatar_url?: string;
    seller_display_name?: string;
    seller_profile_image_url?: string;
  } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "about" | "reviews">("products");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<{
    seller_display_name?: string;
    seller_profile_image_url?: string;
    can_change_name: boolean;
    days_remaining: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [ratingStats, setRatingStats] = useState<any>(null);
  const [sellerRatings, setSellerRatings] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    if (!id) {
      toast.error("Seller not found");
      navigate("/marketplace");
      return;
    }

    const fetchSellerData = async () => {
      setLoading(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id;
        setCurrentUserId(uid || null);
        setIsOwnProfile(uid === id);

        const productsRes = await productsApi.getBySeller(id);
        if (productsRes.data) {
          setProducts(productsRes.data);
        }

        if (productsRes.data && productsRes.data.length > 0) {
          setSeller(productsRes.data[0].users as any);
        }

        // Fetch rating stats and reviews
        const statsRes = await ratingsApi.getSellerStats(id);
        if (statsRes.data?.stats) {
          setRatingStats(statsRes.data.stats);
          setBadges(statsRes.data.badges || []);
        }
        
        const ratingsRes = await ratingsApi.getSellerRatings(id, 1, 10, 'recent');
        if (ratingsRes.data?.ratings) {
          setSellerRatings(ratingsRes.data.ratings);
        }

        if (uid === id) {
          const profileRes = await sellerApi.getProfile();
          if (profileRes.data) {
            setSellerProfile(profileRes.data);
            setDisplayName(profileRes.data.seller_display_name || "");
            setImagePreview(profileRes.data.seller_profile_image_url || null);
            // Also update seller state with profile data so name displays correctly
            setSeller(prev => prev ? {
              ...prev,
              seller_display_name: profileRes.data.seller_display_name,
              seller_profile_image_url: profileRes.data.seller_profile_image_url
            } : null);
          }
        }
      } catch (error) {
        console.error("Error fetching seller:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSellerData();
  }, [id, navigate]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    
    setUploadingAvatar(true);
    try {
      const uploadRes = await sellerApi.uploadProfileImage(file);
      if (uploadRes.error) {
        toast.error(uploadRes.error);
        setUploadingAvatar(false);
        return;
      }
      
      const updateRes = await sellerApi.updateProfile({
        seller_profile_image_url: uploadRes.data?.image_url,
      });
      
      if (updateRes.error) {
        toast.error(updateRes.error);
      } else {
        toast.success("Profile image updated!");
        setSellerProfile(prev => prev ? {
          ...prev,
          seller_profile_image_url: uploadRes.data?.image_url
        } : null);
        window.dispatchEvent(new Event("wm-data-change"));
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      let imageUrl = sellerProfile?.seller_profile_image_url;

      if (selectedImage) {
        const uploadRes = await sellerApi.uploadProfileImage(selectedImage);
        if (uploadRes.error) {
          toast.error(uploadRes.error);
          setSaving(false);
          return;
        }
        imageUrl = uploadRes.data?.image_url;
      }

      const res = await sellerApi.updateProfile({
        seller_display_name: displayName.trim() || undefined,
        seller_profile_image_url: imageUrl,
      });

      if (res.error) {
        if (res.data?.days_remaining) {
          toast.error(`Name change available in ${res.data.days_remaining} days`);
        } else {
          toast.error(res.error);
        }
        setSaving(false);
        return;
      }

      toast.success("Profile updated!");
      setEditMode(false);
      setSelectedImage(null);
      
      const updatedProfile = await sellerApi.getProfile();
      if (updatedProfile.data) {
        setSellerProfile(updatedProfile.data);
      }
      window.dispatchEvent(new Event("wm-data-change"));
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const canChangeName = sellerProfile?.can_change_name ?? true;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-pulse"></div>
            <Loader2 className="h-8 w-8 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-slate-600 font-medium">Loading seller profile...</p>
        </div>
      </div>
    );
  }

  if (!seller && products.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container py-8">
          <button 
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800 mb-6"
            onClick={() => navigate("/marketplace")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace
          </button>
          <Card className="border-0 shadow-xl">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-10 w-10 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Seller Not Found</h2>
              <p className="mt-2 text-slate-600 max-w-md mx-auto">This seller doesn't exist or has no products listed yet.</p>
              <Button asChild className="mt-6">
                <Link to="/marketplace">Browse Products</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Derived seller data with fallbacks and computed values
  const displaySellerName = sellerProfile?.seller_display_name ?? seller?.seller_display_name ?? seller?.full_name ?? "Unknown Seller";
  const sellerInitial = displaySellerName?.[0]?.toUpperCase() ?? "?";
  const profileImageUrl = sellerProfile?.seller_profile_image_url ?? seller?.seller_profile_image_url ?? seller?.avatar_url ?? null;
  
  // Format join date with proper error handling
  const joinDate = (() => {
    if (!seller?.created_at) return "Unknown";
    const date = new Date(seller.created_at);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  })();
  
  const isVerified = seller?.role === "seller" || seller?.role === "admin";
  
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.is_active).length;
  const avgPrice = products.length > 0 
    ? products.reduce((sum, p) => sum + Number(p.price || 0), 0) / products.length 
    : 0;
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Banner Section */}
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-teal-600">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl animate-pulse delay-500"></div>
          </div>
        </div>

        {/* Header Navigation */}
        <div className="relative z-10">
          <div className="container py-4 flex justify-between items-center">
            <button 
              className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 text-sm text-white transition hover:bg-white/20"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {isOwnProfile && !editMode && (
              <button 
                className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm text-white transition hover:bg-white/30"
                onClick={() => setEditMode(true)}
              >
                <Edit3 className="h-4 w-4" /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Edit Mode Form */}
        {editMode && isOwnProfile && (
          <div className="relative z-10 container pb-4">
            <Card className="border-0 shadow-xl bg-white/95 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900">Edit Your Profile</h3>
                  <button onClick={() => setEditMode(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>

                {/* Cooldown Warning */}
                {!canChangeName && sellerProfile?.days_remaining ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-amber-800">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span>Name change available in {sellerProfile.days_remaining} days</span>
                  </div>
                ) : canChangeName && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4 text-emerald-800">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    <span>You can change your display name now</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Profile Image */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Profile Image</label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={imagePreview || undefined} />
                          <AvatarFallback>
                            {sellerInitial}
                          </AvatarFallback>
                        </Avatar>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg"
                        >
                          <Camera className="h-3 w-3" />
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </div>
                      <p className="text-sm text-slate-500">Click to upload new image</p>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={seller?.full_name}
                      maxLength={50}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-slate-500 mt-1">This name will be shown on your seller profile (50 chars max)</p>
                  </div>

                  {/* Save Button */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" /> Save Changes
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditMode(false);
                        setDisplayName(sellerProfile?.seller_display_name || "");
                        setImagePreview(sellerProfile?.seller_profile_image_url || null);
                        setSelectedImage(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hero Content */}
        <div className="relative z-10 container pb-12 pt-8">
          <div className="flex flex-col items-center text-center">
            {/* Avatar with Glow Effect */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse"></div>
              <Avatar className="h-32 w-32 border-4 border-white/30 shadow-2xl relative">
                <AvatarImage src={profileImageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${displaySellerName}`} />
                <AvatarFallback className="text-4xl bg-white text-primary font-bold">
                  {sellerInitial}
                </AvatarFallback>
              </Avatar>
              {isVerified && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-2 shadow-lg">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
              )}
              {isOwnProfile && !editMode && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarDirectUpload}
                    className="hidden"
                  />
                  <button 
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-2 -right-2 bg-primary rounded-full p-2 shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 text-white" />
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Seller Name & Badge */}
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">{displaySellerName}</h1>
              {isVerified && (
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1">
                  <ShieldCheck className="mr-1 h-4 w-4" /> Verified
                </Badge>
              )}
            </div>

            {/* Tagline */}
            <p className="text-lg text-white/90 max-w-2xl mb-6">
              {categories.length > 0 
                ? `Specializing in ${categories.slice(0, 3).join(", ")}`
                : "Campus seller offering quality products"
              }
            </p>

            {/* Stats Row */}
            <div className="flex flex-wrap justify-center gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-white">{totalProducts}</p>
                    <p className="text-sm text-white/80">Products</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <Star className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-white">4.8</p>
                    <p className="text-sm text-white/80">Rating</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-white">~15 min</p>
                    <p className="text-sm text-white/80">Response</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-white">{activeProducts}</p>
                    <p className="text-sm text-white/80">Active</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-3">
              <Button 
                size="lg"
                className="bg-white text-primary hover:bg-white/90 shadow-lg"
                onClick={() => {
                  toast.info("Start a conversation from a product page");
                }}
              >
                <MessageCircle className="mr-2 h-5 w-5" /> Message Seller
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className={`border-white/30 text-primary hover:bg-white/10 ${isFollowing ? 'bg-white/20' : ''}`}
                onClick={() => setIsFollowing(!isFollowing)}
              >
                <Heart className={`mr-2 h-5 w-5 ${isFollowing ? 'fill-current' : ''}`} />
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-white/30 text-primary hover:bg-white/10"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied to clipboard!");
                }}
              >
                <Share2 className="mr-2 h-5 w-5" /> Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8 -mt-8 relative z-10">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${
              activeTab === "products"
                ? "bg-white text-primary shadow-lg"
                : "bg-white/50 text-slate-600 hover:bg-white"
            }`}
          >
            <ShoppingBag className="inline-block mr-2 h-4 w-4" />
            Products ({totalProducts})
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${
              activeTab === "about"
                ? "bg-white text-primary shadow-lg"
                : "bg-white/50 text-slate-600 hover:bg-white"
            }`}
          >
            <Users className="inline-block mr-2 h-4 w-4" />
            About
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${
              activeTab === "reviews"
                ? "bg-white text-primary shadow-lg"
                : "bg-white/50 text-slate-600 hover:bg-white"
            }`}
          >
            <Star className="inline-block mr-2 h-4 w-4" />
            Reviews
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "products" && (
          <div>
            {/* Featured Products */}
            {products.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <h2 className="text-xl font-bold text-slate-900">Featured Products</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {products.slice(0, 4).map((product) => (
                    <Card key={product.id} className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                      <div className="relative overflow-hidden">
                        <img
                          src={product.image_url || "https://via.placeholder.com/640x360?text=White+Market"}
                          alt={product.title}
                          className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-white/95 backdrop-blur-sm text-primary shadow-lg">
                            GHS {Number(product.price || 0).toFixed(2)}
                          </Badge>
                        </div>
                        {product.is_active && (
                          <div className="absolute top-3 left-3">
                            <Badge className="bg-emerald-500 text-white">
                              <Zap className="h-3 w-3 mr-1" /> Active
                            </Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-slate-900 line-clamp-1 mb-2">{product.title}</h3>
                        <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                          {product.description || "No description provided"}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {product.category || "General"}
                          </Badge>
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/product/${product.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* All Products */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                All Products ({products.length})
              </h2>
              
              {products.length === 0 ? (
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingBag className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">No Products Yet</h3>
                    <p className="mt-2 text-slate-600 max-w-md mx-auto">This seller hasn't listed any products yet. Check back later!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <Card key={product.id} className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                      <div className="relative overflow-hidden">
                        <img
                          src={product.image_url || "https://via.placeholder.com/640x360?text=White+Market"}
                          alt={product.title}
                          className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="text-lg font-bold text-white drop-shadow-lg">
                            GHS {Number(product.price || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-slate-900 line-clamp-1 mb-2">{product.title}</h3>
                        <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                          {product.description || "No description provided"}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {product.category || "General"}
                          </Badge>
                          <Button size="sm" asChild>
                            <Link to={`/product/${product.id}`}>View Details</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "about" && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Seller Info Card */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  About {displaySellerName}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-500">Member since</p>
                      <p className="font-medium text-slate-900">{joinDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <MapPin className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-500">Location</p>
                      <p className="font-medium text-slate-900">University of Ghana, Legon</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Award className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-500">Seller Level</p>
                      <p className="font-medium text-slate-900">Rising Star</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Seller Stats
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                    <p className="text-3xl font-bold text-primary">{totalProducts}</p>
                    <p className="text-sm text-slate-600">Total Products</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
                    <p className="text-3xl font-bold text-emerald-600">{activeProducts}</p>
                    <p className="text-sm text-slate-600">Active Listings</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
                    <p className="text-3xl font-bold text-amber-600">4.8</p>
                    <p className="text-sm text-slate-600">Avg Rating</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                    <p className="text-3xl font-bold text-purple-600">GHS {avgPrice.toFixed(0)}</p>
                    <p className="text-sm text-slate-600">Avg Price</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Categories Card */}
            {categories.length > 0 && (
              <Card className="border-0 shadow-lg md:col-span-2">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Categories
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <Badge key={category} variant="outline" className="px-4 py-2 text-sm">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "reviews" && ratingStats ? (
          <SellerRatingStats
            sellerId={id || ""}
            sellerName={seller?.seller_display_name || seller?.full_name || "Seller"}
            stats={ratingStats}
            badges={badges}
            ratings={sellerRatings}
            isSeller={isOwnProfile}
          />
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">No Reviews Yet</h3>
              <p className="mt-2 text-slate-600 max-w-md mx-auto">
                This seller hasn't received any reviews yet. Be the first to purchase and leave a review!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default SellerProfile;
