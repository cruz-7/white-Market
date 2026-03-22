import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Button } from "./button";
import { 
  Trophy, 
  Medal, 
  Crown, 
  User, 
  TrendingUp,
  ArrowLeft,
  RefreshCw
} from "lucide-react";
import { useToast } from "./hooks/use-toast";
import { referralsApi } from "./api";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  total_referrals: number;
  qualified_referrals: number;
  referral_level: number;
  is_campus_ambassador: boolean;
}

export default function LeaderboardPage() {
  const { toast } = useToast();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    const { data, error } = await referralsApi.getLeaderboard(20);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load leaderboard",
        variant: "destructive",
      });
    } else {
      setLeaderboard(data || []);
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-500">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200";
      case 2:
        return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
      case 3:
        return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
      default:
        return "bg-white border-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 via-violet-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link to="/referrals">
            <Button variant="ghost" className="text-white hover:bg-white/20 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Referrals
            </Button>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Trophy className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Referral Leaderboard</h1>
              <p className="text-purple-200">Top referrers on White Market</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        {leaderboard.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* 2nd Place */}
            <Card className={`${getRankBg(2)} border-2 mt-8`}>
              <CardContent className="p-4 text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                  <User className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="font-semibold text-gray-900 truncate">
                  {leaderboard[1]?.full_name || 'User'}
                </h3>
                <div className="flex items-center justify-center gap-1 my-2">
                  <Medal className="w-5 h-5 text-gray-400" />
                  <span className="text-2xl font-bold text-gray-700">
                    {leaderboard[1]?.qualified_referrals || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500">referrals</p>
                {leaderboard[1]?.is_campus_ambassador && (
                  <Badge className="mt-2 bg-purple-100 text-purple-700">
                    <Crown className="w-3 h-3 mr-1" /> Ambassador
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* 1st Place */}
            <Card className={`${getRankBg(1)} border-2`}>
              <CardContent className="p-4 text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                </div>
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-2 mt-2">
                  <User className="w-10 h-10 text-white" />
                </div>
                <h3 className="font-bold text-lg text-gray-900 truncate">
                  {leaderboard[0]?.full_name || 'User'}
                </h3>
                <div className="flex items-center justify-center gap-1 my-2">
                  <span className="text-3xl font-bold text-yellow-600">
                    {leaderboard[0]?.qualified_referrals || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500">referrals</p>
                {leaderboard[0]?.is_campus_ambassador && (
                  <Badge className="mt-2 bg-purple-100 text-purple-700">
                    <Crown className="w-3 h-3 mr-1" /> Ambassador
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* 3rd Place */}
            <Card className={`${getRankBg(3)} border-2 mt-12`}>
              <CardContent className="p-4 text-center">
                <div className="w-14 h-14 bg-amber-200 rounded-full flex items-center justify-center mx-auto mb-2">
                  <User className="w-7 h-7 text-amber-700" />
                </div>
                <h3 className="font-semibold text-gray-900 truncate">
                  {leaderboard[2]?.full_name || 'User'}
                </h3>
                <div className="flex items-center justify-center gap-1 my-2">
                  <Medal className="w-5 h-5 text-amber-600" />
                  <span className="text-2xl font-bold text-amber-700">
                    {leaderboard[2]?.qualified_referrals || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500">referrals</p>
                {leaderboard[2]?.is_campus_ambassador && (
                  <Badge className="mt-2 bg-purple-100 text-purple-700">
                    <Crown className="w-3 h-3 mr-1" /> Ambassador
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Full List */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Full Rankings
          </h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchLeaderboard(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No referrers yet</h3>
              <p className="text-gray-500">Be the first to invite friends and top the leaderboard!</p>
              <Link to="/referrals">
                <Button className="mt-4">Start Referring</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <Card 
                key={entry.user_id} 
                className={`${getRankBg(entry.rank)} border transition hover:shadow-md`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 flex-shrink-0">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      {entry.avatar_url ? (
                        <img 
                          src={entry.avatar_url} 
                          alt={entry.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {entry.full_name || 'Anonymous User'}
                        </h3>
                        {entry.is_campus_ambassador && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs flex-shrink-0">
                            <Crown className="w-3 h-3 mr-1" /> Ambassador
                          </Badge>
                        )}
                        {entry.referral_level > 0 && !entry.is_campus_ambassador && (
                          <Badge className="bg-green-100 text-green-700 text-xs flex-shrink-0">
                            Level {entry.referral_level}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{entry.total_referrals} total invites</span>
                        <span>•</span>
                        <span className="font-medium text-green-600">
                          {entry.qualified_referrals} qualified
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xl font-bold text-gray-900">
                        {entry.qualified_referrals}
                      </span>
                      <p className="text-xs text-gray-500">referrals</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* CTA */}
        <Card className="mt-8 bg-gradient-to-r from-purple-600 to-violet-600 border-0">
          <CardContent className="p-6 text-center text-white">
            <h3 className="text-xl font-bold mb-2">Want to be on the leaderboard?</h3>
            <p className="text-purple-100 mb-4">
              Invite friends to join White Market and earn amazing rewards!
            </p>
            <Link to="/referrals">
              <Button className="bg-white text-purple-700 hover:bg-purple-50">
                Start Referring Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
