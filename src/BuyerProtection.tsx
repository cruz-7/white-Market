import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Clock, MessageSquare, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

export default function BuyerProtection() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      <div className="container py-8">
        <button className="mb-6 inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>

        <div className="mx-auto max-w-4xl space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Buyer Protection</h1>
            <p className="mt-2 text-lg text-slate-600">
              Shop with confidence on White Market
            </p>
          </div>

          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <ShieldCheck className="h-8 w-8 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    You're Protected When You Shop
                  </h3>
                  <p className="text-slate-700">
                    White Market provides comprehensive buyer protection for all eligible purchases.
                    Our team ensures fair resolution for any issues that arise.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Return Window
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">24-Hour Protection</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Report issues within 24 hours of delivery for eligible refunds.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">What Qualifies</h4>
                  <ul className="text-sm text-slate-600 mt-1 space-y-1">
                    <li>• Item significantly different from description</li>
                    <li>• Item damaged during shipping</li>
                    <li>• Item missing from order</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                  Dispute Resolution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">Fair Review Process</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Our team reviews chat history, photos, and order details
                    to make fair decisions.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Evidence Matters</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Provide clear photos and maintain communication records
                    for the best resolution.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  Refund Process
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">Wallet Refunds</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Approved refunds are credited back to your wallet balance
                    within 24-48 hours.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Processing Time</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Most disputes are resolved within 3-5 business days
                    after all evidence is submitted.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  How to File a Claim
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">Step 1: Contact Seller</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Try to resolve directly with the seller through messages first.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Step 2: Report Issue</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    If unresolved, use the "Report an Issue" feature with details and photos.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Step 3: Provide Evidence</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Submit photos, chat history, and order details for review.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility & Coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">✅ Covered</h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• Verified seller transactions</li>
                    <li>• Items damaged in transit</li>
                    <li>• Wrong or missing items</li>
                    <li>• Significant description mismatch</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">❌ Not Covered</h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• Buyer's remorse</li>
                    <li>• Minor cosmetic differences</li>
                    <li>• Unverified seller transactions</li>
                    <li>• Claims after 24-hour window</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Need to File a Claim?
              </h3>
              <p className="text-slate-600 mb-4">
                Our support team is ready to help resolve any purchase issues.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/report">File a Claim</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/faq">View FAQ</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
