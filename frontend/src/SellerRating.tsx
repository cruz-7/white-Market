import { useState, useCallback } from "react";
import { Star, Camera, ThumbsUp, MessageSquare, X, Check, Sparkles } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Badge } from "./badge";
import { Textarea } from "./textarea";
import { Input } from "./input";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { cn } from "./lib/utils";

interface SellerRatingProps {
  orderId: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  onSubmit: (rating: RatingData) => Promise<void>;
  onCancel: () => void;
  existingRating?: RatingData;
}

interface RatingData {
  overall_rating: number;
  product_quality_rating: number;
  communication_rating: number;
  delivery_speed_rating: number;
  packaging_rating: number;
  value_for_money_rating: number;
  review_text?: string;
  review_title?: string;
  feedback_tags: string[];
  review_photos: string[];
  is_anonymous: boolean;
}

const QUICK_TAGS = [
  { id: "great_communication", label: "Great Communication", icon: "💬" },
  { id: "fast_shipping", label: "Fast Shipping", icon: "🚀" },
  { id: "excellent_quality", label: "Excellent Quality", icon: "✨" },
  { id: "well_packaged", label: "Well Packaged", icon: "📦" },
  { id: "great_value", label: "Great Value", icon: "💰" },
  { id: "friendly", label: "Friendly Seller", icon: "😊" },
  { id: "accurate_description", label: "Accurate Description", icon: "📝" },
  { id: "would_buy_again", label: "Would Buy Again", icon: "🔄" },
];

const RATING_CATEGORIES = [
  { key: "product_quality_rating", label: "Product Quality", icon: "✨", description: "How was the quality of the product?" },
  { key: "communication_rating", label: "Communication", icon: "💬", description: "How responsive was the seller?" },
  { key: "delivery_speed_rating", label: "Delivery Speed", icon: "🚀", description: "How fast was the delivery?" },
  { key: "packaging_rating", label: "Packaging", icon: "📦", description: "How well was it packaged?" },
  { key: "value_for_money_rating", label: "Value for Money", icon: "💰", description: "Was it worth the price?" },
];

export function SellerRating({
  orderId,
  sellerId,
  sellerName,
  sellerAvatar,
  onSubmit,
  onCancel,
  existingRating,
}: SellerRatingProps) {
  const [ratings, setRatings] = useState<RatingData>({
    overall_rating: existingRating?.overall_rating || 0,
    product_quality_rating: existingRating?.product_quality_rating || 0,
    communication_rating: existingRating?.communication_rating || 0,
    delivery_speed_rating: existingRating?.delivery_speed_rating || 0,
    packaging_rating: existingRating?.packaging_rating || 0,
    value_for_money_rating: existingRating?.value_for_money_rating || 0,
    review_text: existingRating?.review_text || "",
    review_title: existingRating?.review_title || "",
    feedback_tags: existingRating?.feedback_tags || [],
    review_photos: existingRating?.review_photos || [],
    is_anonymous: existingRating?.is_anonymous || false,
  });

  const [hoveredStar, setHoveredStar] = useState<{ category: string; star: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const handleStarClick = useCallback((category: keyof RatingData, star: number) => {
    setRatings((prev) => ({
      ...prev,
      [category]: star,
    }));

    // Show celebration animation for 5-star ratings
    if (star === 5) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1500);
    }
  }, []);

  const handleTagToggle = useCallback((tagId: string) => {
    setRatings((prev) => ({
      ...prev,
      feedback_tags: prev.feedback_tags.includes(tagId)
        ? prev.feedback_tags.filter((t) => t !== tagId)
        : [...prev.feedback_tags, tagId],
    }));
  }, []);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // In a real app, you'd upload these to a storage service
    // For now, we'll create placeholder URLs
    const newPhotos = Array.from(files).map((file, index) => 
      `photo_${Date.now()}_${index}.jpg`
    );

    setRatings((prev) => ({
      ...prev,
      review_photos: [...prev.review_photos, ...newPhotos].slice(0, 5), // Max 5 photos
    }));
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setRatings((prev) => ({
      ...prev,
      review_photos: prev.review_photos.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSubmit = async () => {
    if (ratings.overall_rating === 0) {
      alert("Please provide an overall rating");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(ratings);
    } catch (error) {
      console.error("Error submitting rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateOverallFromCategories = () => {
    const categoryRatings = [
      ratings.product_quality_rating,
      ratings.communication_rating,
      ratings.delivery_speed_rating,
      ratings.packaging_rating,
      ratings.value_for_money_rating,
    ].filter((r) => r > 0);

    if (categoryRatings.length === 0) return 0;
    return Math.round(categoryRatings.reduce((a, b) => a + b, 0) / categoryRatings.length);
  };

  const renderStars = (
    category: keyof RatingData,
    currentRating: number,
    size: "sm" | "md" | "lg" = "md"
  ) => {
    const sizeClasses = {
      sm: "w-4 h-4",
      md: "w-6 h-6",
      lg: "w-8 h-8",
    };

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isHovered = hoveredStar?.category === category && hoveredStar?.star >= star;
          const isFilled = currentRating >= star;

          return (
            <button
              key={star}
              type="button"
              className={cn(
                "transition-all duration-200 transform hover:scale-110",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded",
                isFilled || isHovered ? "text-yellow-400" : "text-gray-300"
              )}
              onClick={() => handleStarClick(category, star)}
              onMouseEnter={() => setHoveredStar({ category, star })}
              onMouseLeave={() => setHoveredStar(null)}
              aria-label={`Rate ${star} stars`}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  "transition-all duration-200",
                  (isFilled || isHovered) && "fill-current"
                )}
              />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto relative overflow-hidden">
      {/* Celebration Animation */}
      {showCelebration && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="animate-bounce">
            <Sparkles className="w-16 h-16 text-yellow-400 animate-pulse" />
          </div>
          <div className="absolute top-1/4 left-1/4 animate-ping">
            <Sparkles className="w-8 h-8 text-yellow-300" />
          </div>
          <div className="absolute top-1/3 right-1/4 animate-ping delay-100">
            <Sparkles className="w-6 h-6 text-yellow-200" />
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12">
            <AvatarImage src={sellerAvatar} />
            <AvatarFallback>{sellerName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">Rate Your Experience</CardTitle>
            <CardDescription>
              How was your purchase from {sellerName}?
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Rating */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Overall Rating</label>
            <span className="text-2xl font-bold text-primary">
              {ratings.overall_rating > 0 ? ratings.overall_rating : "?"}/5
            </span>
          </div>
          <div className="flex items-center gap-4">
            {renderStars("overall_rating", ratings.overall_rating, "lg")}
            {ratings.overall_rating === 0 && (
              <span className="text-sm text-muted-foreground">
                Click to rate
              </span>
            )}
          </div>
          {ratings.overall_rating === 5 && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
              <Sparkles className="w-4 h-4" />
              <span>Excellent! Thank you for the 5-star rating!</span>
            </div>
          )}
        </div>

        {/* Category Ratings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            Rate specific aspects (optional)
          </h4>
          <div className="grid gap-4">
            {RATING_CATEGORIES.map((category) => (
              <div
                key={category.key}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{category.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{category.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </div>
                {renderStars(
                  category.key as keyof RatingData,
                  ratings[category.key as keyof RatingData] as number,
                  "sm"
                )}
              </div>
            ))}
          </div>
          {calculateOverallFromCategories() > 0 && ratings.overall_rating === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStarClick("overall_rating", calculateOverallFromCategories())}
              className="w-full"
            >
              Use calculated average: {calculateOverallFromCategories()} stars
            </Button>
          )}
        </div>

        {/* Quick Feedback Tags */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Quick feedback (select all that apply)
          </h4>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map((tag) => (
              <Badge
                key={tag.id}
                variant={ratings.feedback_tags.includes(tag.id) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all hover:scale-105",
                  ratings.feedback_tags.includes(tag.id) && "bg-primary"
                )}
                onClick={() => handleTagToggle(tag.id)}
              >
                <span className="mr-1">{tag.icon}</span>
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Review Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Review Title (optional)</label>
          <Input
            placeholder="Summarize your experience in a few words"
            value={ratings.review_title}
            onChange={(e) =>
              setRatings((prev) => ({ ...prev, review_title: e.target.value }))
            }
            maxLength={200}
          />
        </div>

        {/* Review Text */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Your Review (optional)</label>
          <Textarea
            placeholder="Share your experience with other buyers. What did you like? What could be improved?"
            value={ratings.review_text}
            onChange={(e) =>
              setRatings((prev) => ({ ...prev, review_text: e.target.value }))
            }
            rows={4}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {ratings.review_text?.length || 0}/2000
          </p>
        </div>

        {/* Photo Upload */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Add Photos (optional, max 5)
          </h4>
          <div className="flex flex-wrap gap-3">
            {ratings.review_photos.map((photo, index) => (
              <div
                key={index}
                className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted"
              >
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  📷
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {ratings.review_photos.length < 5 && (
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Anonymous Option */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <input
            type="checkbox"
            id="anonymous"
            checked={ratings.is_anonymous}
            onChange={(e) =>
              setRatings((prev) => ({ ...prev, is_anonymous: e.target.checked }))
            }
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="anonymous" className="text-sm">
            Post anonymously (your name will not be shown)
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || ratings.overall_rating === 0}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Submit Rating
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Component to display existing ratings
interface RatingDisplayProps {
  rating: {
    id: string;
    overall_rating: number;
    product_quality_rating?: number;
    communication_rating?: number;
    delivery_speed_rating?: number;
    packaging_rating?: number;
    value_for_money_rating?: number;
    review_text?: string;
    review_title?: string;
    feedback_tags: string[];
    review_photos: string[];
    is_anonymous: boolean;
    seller_response?: string;
    seller_responded_at?: string;
    helpful_count: number;
    created_at: string;
    buyer: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  };
  onHelpful?: (isHelpful: boolean) => void;
  onRespond?: (response: string) => void;
  isSeller?: boolean;
}

export function RatingDisplay({ rating, onHelpful, onRespond, isSeller }: RatingDisplayProps) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseText, setResponseText] = useState("");

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderStarsDisplay = (ratingValue: number, size: "sm" | "md" = "sm") => {
    const sizeClasses = {
      sm: "w-4 h-4",
      md: "w-5 h-5",
    };

    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClasses[size],
              ratingValue >= star ? "text-yellow-400 fill-current" : "text-gray-300"
            )}
          />
        ))}
      </div>
    );
  };

  const handleResponseSubmit = () => {
    if (responseText.trim() && onRespond) {
      onRespond(responseText);
      setShowResponseForm(false);
      setResponseText("");
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={rating.is_anonymous ? undefined : rating.buyer.avatar_url} />
                <AvatarFallback>
                  {rating.is_anonymous ? "?" : rating.buyer.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {rating.is_anonymous ? "Anonymous Buyer" : rating.buyer.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(rating.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {renderStarsDisplay(rating.overall_rating, "md")}
              <span className="font-bold text-lg">{rating.overall_rating}</span>
            </div>
          </div>

          {/* Review Title */}
          {rating.review_title && (
            <h4 className="font-semibold">{rating.review_title}</h4>
          )}

          {/* Category Ratings */}
          {(rating.product_quality_rating || rating.communication_rating || 
            rating.delivery_speed_rating || rating.packaging_rating || 
            rating.value_for_money_rating) && (
            <div className="flex flex-wrap gap-2">
              {rating.product_quality_rating && (
                <Badge variant="secondary" className="text-xs">
                  ✨ Quality: {rating.product_quality_rating}/5
                </Badge>
              )}
              {rating.communication_rating && (
                <Badge variant="secondary" className="text-xs">
                  💬 Communication: {rating.communication_rating}/5
                </Badge>
              )}
              {rating.delivery_speed_rating && (
                <Badge variant="secondary" className="text-xs">
                  🚀 Speed: {rating.delivery_speed_rating}/5
                </Badge>
              )}
              {rating.packaging_rating && (
                <Badge variant="secondary" className="text-xs">
                  📦 Packaging: {rating.packaging_rating}/5
                </Badge>
              )}
              {rating.value_for_money_rating && (
                <Badge variant="secondary" className="text-xs">
                  💰 Value: {rating.value_for_money_rating}/5
                </Badge>
              )}
            </div>
          )}

          {/* Quick Tags */}
          {rating.feedback_tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rating.feedback_tags.map((tagId) => {
                const tag = QUICK_TAGS.find((t) => t.id === tagId);
                return tag ? (
                  <Badge key={tagId} variant="outline" className="text-xs">
                    {tag.icon} {tag.label}
                  </Badge>
                ) : null;
              })}
            </div>
          )}

          {/* Review Text */}
          {rating.review_text && (
            <p className="text-sm text-muted-foreground">{rating.review_text}</p>
          )}

          {/* Photos */}
          {rating.review_photos.length > 0 && (
            <div className="flex gap-2">
              {rating.review_photos.map((photo, index) => (
                <div
                  key={index}
                  className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-2xl"
                >
                  📷
                </div>
              ))}
            </div>
          )}

          {/* Seller Response */}
          {rating.seller_response && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Seller Response</span>
                {rating.seller_responded_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(rating.seller_responded_at)}
                  </span>
                )}
              </div>
              <p className="text-sm">{rating.seller_response}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4">
              {onHelpful && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onHelpful(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ThumbsUp className="w-4 h-4 mr-1" />
                  Helpful ({rating.helpful_count})
                </Button>
              )}
            </div>
            {isSeller && !rating.seller_response && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResponseForm(true)}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Respond
              </Button>
            )}
          </div>

          {/* Response Form */}
          {showResponseForm && (
            <div className="mt-4 space-y-2">
              <Textarea
                placeholder="Write your response..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResponseForm(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleResponseSubmit}>
                  Submit Response
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
