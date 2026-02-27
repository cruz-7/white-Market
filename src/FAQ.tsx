import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

export default function FAQ() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      <div className="container py-8">
        <button 
          onClick={() => navigate(-1)} 
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>

        <div className="mx-auto max-w-4xl space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Help Center</h1>
            <p className="mt-2 text-lg text-slate-600">
              Find answers to common questions about using White Market
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Getting Started
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">How do I create an account?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Sign up using your University of Ghana email (@st.ug.edu.gh or @ug.edu.gh).
                    Complete your profile setup to start buying or selling.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">How do I verify my student status?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Upload a valid student ID during profile setup. Our team reviews
                    all submissions to ensure campus safety.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Can I buy and sell at the same time?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Yes! Set your role to "Both" during signup to access all features.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Buying & Selling
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">How do payments work?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Use your wallet balance to pay instantly. Top up with Paystack
                    or mobile money for seamless transactions.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">What if I receive a damaged item?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Contact support within 24 hours. Buyer Protection covers
                    eligible cases with refunds to your wallet.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">How do I list a product?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Go to your dashboard, click "Add Product", fill in details,
                    and set your price. Products are reviewed before going live.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account & Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">How do I reset my password?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Use the "Forgot Password" link on the login page. Check your
                    university email for reset instructions.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Is my data safe?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Yes, we use industry-standard encryption and never share
                    personal information without permission.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">How do I contact support?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Use the "Report an Issue" link in the footer or message
                    us through the app for immediate assistance.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery & Logistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">What delivery options are available?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Campus pickup (free), same-day delivery, or next-day delivery
                    depending on seller location and item type.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">How long do deliveries take?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Most orders are delivered within 24 hours. Track your order
                    status in real-time from your dashboard.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Can I change my delivery address?</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Contact the seller directly through messages to update
                    delivery details before the item ships.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Still need help?
              </h3>
              <p className="text-slate-600 mb-4">
                Our support team is here to help with any questions.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/report">Report an Issue</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/safety">Safety Tips</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
