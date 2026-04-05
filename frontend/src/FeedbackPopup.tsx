import { useState, useEffect, useRef } from "react";
import { Star, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Textarea } from "./textarea";
import { feedbackApi } from "./api";
import { toast } from "sonner";

const FEEDBACK_DELAY_MS = 10000; // Show after 10 seconds for testing, change to 120000 for production 
const STORAGE_KEY = "wm_feedback_submitted";

interface FeedbackPopupProps {
  onClose?: () => void;
}

export default function FeedbackPopup({ onClose }: FeedbackPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [isSatisfied, setIsSatisfied] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionStart] = useState(() => Date.now());
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const hasSubmitted = localStorage.getItem(STORAGE_KEY);
    if (hasSubmitted) {
      return;
    }

    const timer = setTimeout(() => {
      setIsOpen(true);
      startTimeRef.current = Date.now();
    }, FEEDBACK_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    const sessionDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      await feedbackApi.submitFeedback({
        rating,
        feedback_text: feedbackText || undefined,
        would_recommend: wouldRecommend ?? undefined,
        is_satisfied: isSatisfied ?? undefined,
        feedback_type: "general",
        session_duration_seconds: sessionDuration,
      });
      
      localStorage.setItem(STORAGE_KEY, "true");
      toast.success("Thank you for your feedback!");
      handleClose();
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLater = () => {
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="font-display text-lg font-semibold">How was your experience?</h3>
          <button
            onClick={handleLater}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <CardContent className="space-y-5 p-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              We&apos;d love to hear your thoughts about White Market
            </p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-transform hover:scale-110"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoverRating || rating)
                        ? "fill-accent text-accent"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm font-medium">
              {rating === 0 && "Tap to rate"}
              {rating === 1 && "Poor"}
              {rating === 2 && "Fair"}
              {rating === 3 && "Good"}
              {rating === 4 && "Very Good"}
              {rating === 5 && "Excellent!"}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-center">Would you recommend White Market to a friend?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setWouldRecommend(true)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
                  wouldRecommend === true
                    ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="text-sm">Yes</span>
              </button>
              <button
                onClick={() => setWouldRecommend(false)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
                  wouldRecommend === false
                    ? "bg-red-100 text-red-700 ring-2 ring-red-500"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <ThumbsDown className="h-4 w-4" />
                <span className="text-sm">No</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-center">Are you satisfied with the platform?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setIsSatisfied(true)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
                  isSatisfied === true
                    ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span className="text-sm">😊 Satisfied</span>
              </button>
              <button
                onClick={() => setIsSatisfied(false)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
                  isSatisfied === false
                    ? "bg-red-100 text-red-700 ring-2 ring-red-500"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span className="text-sm">😞 Not satisfied</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Anything else you&apos;d like to share? (optional)
            </label>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell us more about your experience..."
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleLater}
              className="flex-1"
              disabled={isSubmitting}
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={isSubmitting || rating === 0}
            >
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}