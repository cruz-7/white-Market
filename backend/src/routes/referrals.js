import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

// GET /referrals/dashboard - Get user's referral dashboard data
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_referral_dashboard', {
      user_id_input: req.user.id
    });

    if (error) {
      console.error('Dashboard error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /referrals/code - Get user's referral code
router.get('/code', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_or_create_user_referral_code', {
      user_id_input: req.user.id
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get basic stats
    const { data: user } = await supabase
      .from('users')
      .select('total_referrals, qualified_buyer_referrals, qualified_seller_referrals, referral_level, is_campus_ambassador')
      .eq('id', req.user.id)
      .single();

    res.json({
      referral_code: data,
      referral_link: `https://whitemarket.com/signup?ref=${data}`,
      total_referrals: user?.total_referrals || 0,
      qualified_buyer_referrals: user?.qualified_buyer_referrals || 0,
      qualified_seller_referrals: user?.qualified_seller_referrals || 0,
      referral_level: user?.referral_level || 0,
      is_campus_ambassador: user?.is_campus_ambassador || false
    });
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /referrals/leaderboard - Get top referrers
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const { data, error } = await supabase.rpc('get_referral_leaderboard', {
      limit_count: limit
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /referrals/verify - Verify a referral code (used during signup)
router.post('/verify', async (req, res) => {
  try {
    const { referral_code } = req.body;

    if (!referral_code) {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    // Find referrer by code
    const { data: referral, error } = await supabase
      .from('referrals')
      .select(`
        *,
        users:referrer_id(full_name, avatar_url)
      `)
      .eq('referral_code', referral_code.toUpperCase())
      .single();

    if (error || !referral) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    return res.json({
      valid: true,
      referrer: {
        id: referral.referrer_id,
        name: referral.users?.full_name || 'Unknown',
        avatar_url: referral.users?.avatar_url
      },
    });
  } catch (error) {
    console.error('Verify referral error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /referrals/claim - Claim referral on signup (called during registration)
router.post('/claim', requireAuth, async (req, res) => {
  try {
    const { referral_code } = req.body;

    if (!referral_code) {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    // Use the database function to handle referral claiming
    const { data, error } = await supabase.rpc('claim_referral_on_signup', {
      new_user_id: req.user.id,
      referral_code_input: referral_code
    });

    if (error) {
      console.error('Claim error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (data && !data.success) {
      return res.status(400).json({ error: data.message });
    }

    res.json({ message: 'Referral claimed successfully' });
  } catch (error) {
    console.error('Claim referral error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /referrals/stats - Get user's referral statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    // Get all referrals
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select(`
        id,
        referred_id,
        referral_code,
        referral_type,
        status,
        qualified_at,
        purchase_completed_at,
        seller_listed_at,
        created_at,
        users:referred_id(full_name, email, avatar_url)
      `)
      .eq('referrer_id', req.user.id)
      .neq('referred_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get user stats
    const { data: user } = await supabase
      .from('users')
      .select(`
        total_referrals,
        qualified_buyer_referrals,
        qualified_seller_referrals,
        platform_credit,
        commission_discount_sales_remaining,
        referral_level,
        is_campus_ambassador
      `)
      .eq('id', req.user.id)
      .single();

    // Get rewards history
    const { data: rewards } = await supabase
      .from('referral_rewards')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    const totalReferrals = (referrals || []).length;
    const qualifiedReferrals = (referrals || []).filter(r => r.status === 'qualified').length;
    const pendingReferrals = totalReferrals - qualifiedReferrals;

    res.json({
      total_referrals: totalReferrals,
      qualified_referrals: qualifiedReferrals,
      pending_referrals: pendingReferrals,
      buyer_referrals: user?.qualified_buyer_referrals || 0,
      seller_referrals: user?.qualified_seller_referrals || 0,
      platform_credit: user?.platform_credit || 0,
      commission_discount_remaining: user?.commission_discount_sales_remaining || 0,
      referral_level: user?.referral_level || 0,
      is_campus_ambassador: user?.is_campus_ambassador || false,
      referrals: referrals || [],
      rewards: rewards || []
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /referrals/process-buyer-qualification - Process buyer referral (admin/internal use)
router.post('/process-buyer', requireAuth, async (req, res) => {
  try {
    // This should only be called by the system when a purchase is completed
    const { buyer_user_id } = req.body;

    if (!buyer_user_id) {
      return res.status(400).json({ error: 'buyer_user_id is required' });
    }

    const { data, error } = await supabase.rpc('process_buyer_referral_qualification', {
      buyer_user_id: buyer_user_id
    });

    if (error) {
      console.error('Process buyer error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Process buyer qualification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /referrals/process-seller-qualification - Process seller referral (admin/internal use)
router.post('/process-seller', requireAuth, async (req, res) => {
  try {
    const { seller_user_id } = req.body;

    if (!seller_user_id) {
      return res.status(400).json({ error: 'seller_user_id is required' });
    }

    const { data, error } = await supabase.rpc('process_seller_referral_qualification', {
      seller_user_id: seller_user_id
    });

    if (error) {
      console.error('Process seller error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Process seller qualification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /referrals/milestones - Get milestone definitions
router.get('/milestones', async (req, res) => {
  const milestones = [
    {
      level: 1,
      name: 'Starter',
      required_referrals: 3,
      reward: 'GHS 5 platform credit',
      reward_type: 'credit',
      reward_value: '5',
      description: 'Invite 3 friends who make a purchase or become sellers'
    },
    {
      level: 2,
      name: 'Growth',
      required_referrals: 10,
      reward: 'GHS 20 platform credit',
      reward_type: 'credit',
      reward_value: '20',
      description: 'Reach 10 qualified referrals'
    },
    {
      level: 3,
      name: 'Champion',
      required_referrals: 25,
      reward: '0% commission for 20 sales',
      reward_type: 'commission_discount',
      reward_value: '20',
      description: 'Reach 25 qualified referrals'
    },
    {
      level: 4,
      name: 'Campus Ambassador',
      required_referrals: 50,
      reward: 'Campus Ambassador badge + permanent 5% discount',
      reward_type: 'ambassador',
      reward_value: '5',
      description: 'Reach 50 qualified referrals and become a campus ambassador'
    }
  ];

  res.json(milestones);
});

// GET /referrals/admin-stats - Admin stats (admin only)
router.get('/admin-stats', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get total stats
    const { data: totals } = await supabase
      .from('users')
      .select(`
        id,
        total_referrals,
        qualified_buyer_referrals,
        qualified_seller_referrals,
        platform_credit,
        referral_level,
        is_campus_ambassador
      `);

    const totalReferrals = totals?.reduce((sum, u) => sum + (u.total_referrals || 0), 0) || 0;
    const totalQualified = totals?.reduce((sum, u) => 
      sum + (u.qualified_buyer_referrals || 0) + (u.qualified_seller_referrals || 0), 0) || 0;
    const totalCredits = totals?.reduce((sum, u) => sum + (u.platform_credit || 0), 0) || 0;
    const totalAmbassadors = totals?.filter(u => u.is_campus_ambassador).length || 0;

    // Get top referrers
    const { data: topReferrers } = await supabase
      .from('users')
      .select('id, full_name, email, total_referrals, qualified_buyer_referrals, qualified_seller_referrals')
      .order('total_referrals', { ascending: false })
      .limit(10);

    // Get rewards issued
    const { data: rewards } = await supabase
      .from('referral_rewards')
      .select('reward_type, reward_value');

    const creditsIssued = rewards?.filter(r => r.reward_type === 'credit').length * 5 || 0;
    const discountsIssued = rewards?.filter(r => r.reward_type === 'commission_discount').length || 0;

    res.json({
      total_referrals: totalReferrals,
      total_qualified_referrals: totalQualified,
      total_platform_credits_issued: totalCredits,
      total_ambassadors: totalAmbassadors,
      credits_issued_count: creditsIssued,
      commission_discounts_issued: discountsIssued,
      top_referrers: topReferrers || []
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
