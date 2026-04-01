import { useState, useEffect } from "react";
import { Star, TrendingUp, Award, MessageSquare, ThumbsUp, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Badge } from "./badge";
import { Button } from "./button";
import { Progress } from "./progress";
import { cn } from "./lib/utils";
import { RatingDisplay } from "./SellerRating";

interface SellerRatingStatsProps {
  sellerId: string;
  sellerName: string;
  stats: {
    total_ratings: number;
    avg_overall_rating: number;
    avg_product_quality_rating: number;
    avg_communication_rating: number;
    avg_delivery_speed_rating: number;
    avg_packaging_rating: number;
    avg_value_for_money_rating: number;
    five_star_count: number;
    four_star_count: number;
    three_star_count: number;
    two_star_count: number;
    one_star_count: number;
  };
  badges: Array<{
    id: string;
    badge_type: string;
    badge_name: string;
    badge_description: string;
    badge_icon: string;
    earned_at: string;
  }>;
  ratings: Array<any>;
  onHelpful?: (ratingId: string, isHelpful: boolean) => void;
  onRespond?: (ratingId: string, response: string) => void;
  isSeller?: boolean;
}

export function SellerRatingStats({
  sellerId,
  sellerName,
  stats,
  badges,
  ratings,
  onHelpful,
  onRespond,
  isSeller,
}: SellerRatingStatsProps) {
  const [showAllRatings, setShowAllRatings] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "highest" | "lowest" | "helpful">("recent");

  const renderStars = (rating: number, size: "sm" | "md" | "lg" = "md") => {
    const sizeClasses = {
      sm: "w-4 h-4",
      md: "w-5 h-5",
      lg: "w-6 h-6",
    };

    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClasses[size],
              rating >= star ? "text-yellow-400 fill-current" : "text-gray-300"
            )}
          />
        ))}
      </div>
    );
  };

  const getRatingPercentage = (count: number) => {
    if (stats.total_ratings === 0) return 0;
    return Math.round((count / stats.total_ratings) * 100);
  };

  const sortedRatings = [...ratings].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "highest":
        return b.overall_rating - a.overall_rating;
      case "lowest":
        return a.overall_rating - b.overall_rating;
      case "helpful":
        return b.helpful_count - a.helpful_count;
      default:
        return 0;
    }
  });

  const displayedRatings = showAllRatings ? sortedRatings : sortedRatings.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Overall Stats Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Seller Ratings</CardTitle>
              <CardDescription>
                {stats.total_ratings} {stats.total_ratings === 1 ? "review" : "reviews"} for {sellerName}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="text-4xl font-bold text-primary">
                  {stats.avg_overall_rating.toFixed(1)}
                </span>
                <div>
                  {renderStars(Math.round(stats.avg_overall_rating), "lg")}
                  <p className="text-sm text-muted-foreground mt-1">
                    out of 5
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Badges */}
          {badges.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Award className="w-4 h-4" />
                Seller Badges
              </h4>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <Badge
                    key={badge.id}
                    variant="secondary"
                    className="flex items-center gap-1.5 px-3 py-1.5"
                    title={badge.badge_description}
                  >
                    <span className="text-lg">{badge.badge_icon}</span>
                    <span>{badge.badge_name}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Rating Breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Star Distribution */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Rating Distribution
              </h4>
              <div className="space-y-2">
                {[
                  { stars: 5, count: stats.five_star_count },
                  { stars: 4, count: stats.four_star_count },
                  { stars: 3, count: stats.three_star_count },
                  { stars: 2, count: stats.two_star_count },
                  { stars: 1, count: stats.one_star_count },
                ].map(({ stars, count }) => (
                  <div key={stars} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-16">
                      <span className="text-sm font-medium">{stars}</span>
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    </div>
                    <Progress
                      value={getRatingPercentage(count)}
                      className="flex-1 h-2"
                    />
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Averages */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Category Averages
              </h4>
              <div className="space-y-3">
                {[
                  { label: "Product Quality", value: stats.avg_product_quality_rating, icon: "✨" },
                  { label: "Communication", value: stats.avg_communication_rating, icon: "💬" },
                  { label: "Delivery Speed", value: stats.avg_delivery_speed_rating, icon: "🚀" },
                  { label: "Packaging", value: stats.avg_packaging_rating, icon: "📦" },
                  { label: "Value for Money", value: stats.avg_value_for_money_rating, icon: "💰" },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{icon}</span>
                      <span className="text-sm">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStars(Math.round(value), "sm")}
                      <span className="text-sm font-medium w-8">
                        {value.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Ratings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Customer Reviews</CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-sm border rounded-md px-2 py-1"
                title="Sort reviews by"
              >
                <option value="recent">Most Recent</option>
                <option value="highest">Highest Rated</option>
                <option value="lowest">Lowest Rated</option>
                <option value="helpful">Most Helpful</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ratings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No reviews yet</p>
              <p className="text-sm">Be the first to review this seller!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedRatings.map((rating) => (
                <RatingDisplay
                  key={rating.id}
                  rating={rating}
                  onHelpful={onHelpful ? (isHelpful) => onHelpful(rating.id, isHelpful) : undefined}
                  onRespond={onRespond ? (response) => onRespond(rating.id, response) : undefined}
                  isSeller={isSeller}
                />
              ))}

              {ratings.length > 3 && (
                <Button
                  variant="outline"
                  onClick={() => setShowAllRatings(!showAllRatings)}
                  className="w-full"
                >
                  {showAllRatings ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-2" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Show All {ratings.length} Reviews
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Compact rating display for product cards
interface CompactRatingProps {
  rating: number;
  totalRatings: number;
  showCount?: boolean;
}

export function CompactRating({ rating, totalRatings, showCount = true }: CompactRatingProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "w-3.5 h-3.5",
              rating >= star ? "text-yellow-400 fill-current" : "text-gray-300"
            )}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      {showCount && (
        <span className="text-xs text-muted-foreground">
          ({totalRatings})
        </span>
      )}
    </div>
  );
}

// Rating summary widget for seller dashboard
interface RatingSummaryWidgetProps {
  stats: {
    total_ratings: number;
    avg_overall_rating: number;
    five_star_count: number;
    four_star_count: number;
    three_star_count: number;
    two_star_count: number;
    one_star_count: number;
  };
  onViewAll?: () => void;
}

export function RatingSummaryWidget({ stats, onViewAll }: RatingSummaryWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Ratings Overview</CardTitle>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">
              {stats.avg_overall_rating.toFixed(1)}
            </div>
            <div className="flex items-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "w-4 h-4",
                    stats.avg_overall_rating >= star
                      ? "text-yellow-400 fill-current"
                      : "text-gray-300"
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total_ratings} {stats.total_ratings === 1 ? "review" : "reviews"}
            </p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[
              { stars: 5, count: stats.five_star_count },
              { stars: 4, count: stats.four_star_count },
              { stars: 3, count: stats.three_star_count },
              { stars: 2, count: stats.two_star_count },
              { stars: 1, count: stats.one_star_count },
            ].map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-2">
                <span className="text-xs w-3">{stars}</span>
                <Progress
                  value={stats.total_ratings > 0 ? (count / stats.total_ratings) * 100 : 0}
                  className="flex-1 h-1.5"
                />
                <span className="text-xs text-muted-foreground w-6 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
