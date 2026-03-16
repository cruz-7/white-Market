import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Loader2, Gift, Users, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { referralsApi } from "./api";
import { timeAgo } from "./data";

export default function ReferralsPage() {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState("");
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [recentReferrals, setRecentReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    setLoading(true);
    const { data, error } = await referralsApi.getCode();
    if (error) {
      toast.error(error);
    } else {
      setReferralCode(data?.referral_code || "");
      setTotalReferrals(data?.total_referrals || 0);
      setRecentReferrals(data?.recent_referrals || []);
    }
    setLoading(false);
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    
    setCopying(true);
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied to clipboard!");
    } catch {
      toast.error("Failed to copy code");
    }
    setCopying(false);
  };

  const shareReferral = (platform: string) => {
    const shareText = `Join me on White Market - the University of Ghana student marketplace! Use my referral code: ${referralCode}`;
    const shareUrl = window.location.origin;
    
    let url = "";
    switch (platform) {
      case "whatsapp":
        url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
        break;
      default:
        return;
    }
    
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <Gift className="h-8 w-8 text-orange-500" />
        <h1 className="text-2xl font-bold">Refer Friends</h1>
      </div>

      {/* Referral Code Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Referral Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                value={referralCode}
                readOnly
                className="text-xl font-mono text-center sm:text-left"
                placeholder="Loading..."
              />
            </div>
            <Button
              onClick={handleCopyCode}
              disabled={copying || !referralCode}
              className="min-w-[120px]"
            >
              {copying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <div className="mt-6">
            <p className="text-sm text-gray-600 mb-4">Share with friends:</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => shareReferral("whatsapp")}
                className="flex-1"
              >
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => shareReferral("twitter")}
                className="flex-1"
              >
                Twitter
              </Button>
              <Button
                variant="outline"
                onClick={() => shareReferral("facebook")}
                className="flex-1"
              >
                Facebook
              </Button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-orange-50 rounded-lg">
            <h4 className="font-semibold text-orange-800 mb-2">How it works</h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>1. Share your referral code with friends</li>
              <li>2. They sign up using your code</li>
              <li>3. You earn rewards when they make their first purchase!</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Referrals</p>
                <p className="text-2xl font-bold">{totalReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Successful Referrals</p>
                <p className="text-2xl font-bold">{recentReferrals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <Gift className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Rewards</p>
                <p className="text-2xl font-bold">{Math.max(0, totalReferrals - recentReferrals.length)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {recentReferrals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No referrals yet. Share your code to get started!
            </p>
          ) : (
            <div className="space-y-4">
              {recentReferrals.map((referral, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">New User</p>
                      <p className="text-sm text-gray-500">
                        Joined {timeAgo(referral.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Success</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}