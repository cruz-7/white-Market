import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Copy, 
  Loader2, 
  Gift, 
  Users, 
  TrendingUp,
  Trophy,
  Share2,
  Wallet,
  Percent,
  Crown,
  Star,
  CheckCircle,
  Target,
  Award
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { referralsApi } from "./api";
import { CelebrationPopup, useCelebration } from "./CelebrationPopup";

interface ReferralStats {
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  qualified_buyer_referrals: number;
  qualified_seller_referrals: number;
  total_qualified: number;
  platform_credit: number;
  commission_discount_remaining: number;
  referral_level: number;
  is_campus_ambassador: boolean;
  next_milestone: number | null;
  next_reward: string;
  progress_to_next: number;
}

interface Milestone {
  level: number;
  name: string;
  required_referrals: number;
  reward: string;
  reward_type: string;
  reward_value: string;
  description: string;
}

const MILESTONES: Milestone[] = [
  {
    level: 1,
    name: "Starter",
    required_referrals: 3,
    reward: "GHS 5 platform credit",
    reward_type: "credit",
    reward_value: "5",
    description: "Invite 3 friends who make a purchase or become sellers"
  },
  {
    level: 2,
    name: "Growth",
    required_referrals: 10,
    reward: "GHS 20 platform credit",
    reward_type: "credit",
    reward_value: "20",
    description: "Reach 10 qualified referrals"
  },
  {
    level: 3,
    name: "Champion",
    required_referrals: 25,
    reward: "0% commission for 20 sales",
    reward_type: "commission_discount",
    reward_value: "20",
    description: "Reach 25 qualified referrals"
  },
  {
    level: 4,
    name: "Campus Ambassador",
    required_referrals: 50,
    reward: "Campus Ambassador badge + permanent 5% discount",
    reward_type: "ambassador",
    reward_value: "5",
    description: "Reach 50 qualified referrals"
  }
];

export default function ReferralsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>(MILESTONES);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const { celebration, celebrate, close } = useCelebration();
  const [hasCelebrated, setHasCelebrated] = useState(false);

  // Check for milestone celebration when stats load
  useEffect(() => {
    if (stats && !hasCelebrated) {
      const totalQualified = stats.total_qualified;
      if (totalQualified >= 50) {
        celebrate('50_referrals');
        setHasCelebrated(true);
      } else if (totalQualified >= 25) {
        celebrate('25_referrals');
        setHasCelebrated(true);
      } else if (totalQualified >= 10) {
        celebrate('10_referrals');
        setHasCelebrated(true);
      } else if (totalQualified >= 3) {
        celebrate('3_referrals');
        setHasCelebrated(true);
      }
    }
  }, [stats, hasCelebrated, celebrate]);

  useEffect(() => {
    loadReferralData();
  }, []);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    setLoading(true);
    
    // Load dashboard data
    const { data: dashboardData, error } = await referralsApi.getDashboard();
    
    if (error) {
      // Fall back to basic getCode
      const { data: codeData } = await referralsApi.getCode();
      if (codeData) {
        setStats({
          referral_code: codeData.referral_code,
          referral_link: codeData.referral_link,
          total_referrals: codeData.total_referrals,
          qualified_buyer_referrals: 0,
          qualified_seller_referrals: 0,
          total_qualified: 0,
          platform_credit: 0,
          commission_discount_remaining: 0,
          referral_level: codeData.referral_level,
          is_campus_ambassador: codeData.is_campus_ambassador,
          next_milestone: 3,
          next_reward: "GHS 5 platform credit",
          progress_to_next: 0
        });
      }
    } else if (dashboardData) {
      setStats(dashboardData);
    }
    
    // Load milestones from API
    const { data: milestonesData } = await referralsApi.getMilestones();
    if (milestonesData) {
      setMilestones(milestonesData);
    }
    
    setLoading(false);
  };

  const handleCopyCode = async () => {
    if (!stats?.referral_code) return;
    
    setCopying(true);
    try {
      await navigator.clipboard.writeText(stats.referral_code);
      toast.success("Referral code copied!");
    } catch {
      toast.error("Failed to copy code");
    }
    setCopying(false);
  };

  const handleCopyLink = async () => {
    if (!stats?.referral_link) return;
    
    setCopying(true);
    try {
      await navigator.clipboard.writeText(stats.referral_link);
      toast.success("Referral link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
    setCopying(false);
  };

  const shareOnWhatsApp = () => {
    if (!stats?.referral_link) return;
    const text = `Join me on White Market! Use my referral code: ${stats.referral_code} - ${stats.referral_link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const getMilestoneStatus = (level: number) => {
    if (!stats) return "locked";
    if (stats.referral_level >= level) return "completed";
    if (stats.referral_level + 1 === level) return "in_progress";
    return "locked";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-purple-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Gift className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Invite Friends & Earn</h1>
                <p className="text-purple-200">Share your referral code and earn amazing rewards!</p>
              </div>
            </div>
            
            <Link to="/leaderboard">
              <Button variant="secondary" className="gap-2">
                <Trophy className="w-4 h-4" />
                Leaderboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{stats?.total_referrals || 0}</div>
              <div className="text-xs text-gray-500">Total Invites</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{stats?.total_qualified || 0}</div>
              <div className="text-xs text-gray-500">Qualified</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4 text-center">
              <Wallet className="w-6 h-6 text-amber-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">GHS {stats?.platform_credit || 0}</div>
              <div className="text-xs text-gray-500">Platform Credit</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4 text-center">
              <Percent className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{stats?.commission_discount_remaining || 0}</div>
              <div className="text-xs text-gray-500">Free Sales</div>
            </CardContent>
          </Card>
        </div>

        {/* Ambassador Badge */}
        {stats?.is_campus_ambassador && (
          <Card className="mb-8 bg-gradient-to-r from-purple-600 to-violet-600 border-0">
            <CardContent className="p-6 text-center text-white">
              <Crown className="w-12 h-12 mx-auto mb-3" />
              <h2 className="text-xl font-bold">🎓 Campus Ambassador</h2>
              <p className="text-purple-100">You've reached the highest level! Enjoy permanent 5% commission discount.</p>
            </CardContent>
          </Card>
        )}

        {/* Referral Code Card */}
        <Card className="mb-8 border-2 border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Your Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm text-gray-500 mb-1 block">Referral Code</label>
                <div className="flex gap-2">
                  <Input 
                    value={stats?.referral_code || ""} 
                    readOnly 
                    className="font-mono text-lg font-bold text-purple-700 bg-purple-50"
                  />
                  <Button onClick={handleCopyCode} disabled={copying}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1">
                <label className="text-sm text-gray-500 mb-1 block">Referral Link</label>
                <div className="flex gap-2">
                  <Input 
                    value={stats?.referral_link || ""} 
                    readOnly 
                    className="text-sm bg-gray-50"
                  />
                  <Button onClick={handleCopyLink} disabled={copying}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={shareOnWhatsApp} className="bg-green-500 hover:bg-green-600 gap-2">
                <Share2 className="w-4 h-4" />
                Share on WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress Section */}
        {stats && stats.next_milestone && (
          <Card className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-600" />
                    Progress to Next Reward
                  </h3>
                  <p className="text-sm text-gray-600">
                    {stats.total_qualified} / {stats.next_milestone} qualified referrals
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">{stats.next_reward}</div>
                </div>
              </div>
              <Progress value={stats.progress_to_next || 0} className="h-3" />
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          Milestones
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {milestones.map((milestone) => {
            const status = getMilestoneStatus(milestone.level);
            return (
              <Card 
                key={milestone.level} 
                className={`${
                  status === "completed" 
                    ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200" 
                    : status === "in_progress"
                    ? "bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200"
                    : "bg-gray-50 border-gray-100 opacity-60"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`
                      ${status === "completed" ? "bg-green-500" : ""}
                      ${status === "in_progress" ? "bg-purple-500" : "bg-gray-400"}
                    `}>
                      Level {milestone.level}
                    </Badge>
                    {status === "completed" && <CheckCircle className="w-5 h-5 text-green-500" />}
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-1">{milestone.name}</h3>
                  <p className="text-xs text-gray-500 mb-3">{milestone.description}</p>
                  
                  <div className="text-sm font-bold text-purple-600">
                    {milestone.reward}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* How it works */}
        <Card className="mb-8 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Share Your Code</h4>
                  <p className="text-sm text-gray-500">Share your unique referral code with friends</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Friends Sign Up</h4>
                  <p className="text-sm text-gray-500">They create an account using your code</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">They Become Active</h4>
                  <p className="text-sm text-gray-500">Buyer: Make first purchase | Seller: List first product</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-600 font-bold">4</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">You Earn Rewards</h4>
                  <p className="text-sm text-gray-500">Get platform credit or commission discounts!</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard CTA */}
        <Card className="bg-gradient-to-r from-purple-600 to-violet-600 border-0 text-white">
          <CardContent className="p-6 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3" />
            <h3 className="text-xl font-bold mb-2">Compete on the Leaderboard!</h3>
            <p className="text-purple-100 mb-4">
              See how you rank against other top referrers
            </p>
            <Link to="/leaderboard">
              <Button className="bg-white text-purple-700 hover:bg-purple-50">
                View Leaderboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      {/* Celebration Popup */}
      <CelebrationPopup milestone={celebration} onClose={close} />
    </div>
  );
}
