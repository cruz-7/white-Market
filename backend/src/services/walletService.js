/**
 * Wallet Service for White Market
 * Handles all wallet operations including balance, credits, and limits
 * Compatible with the production database schema
 */

import { supabase } from '../lib/supabaseClient.js';

/**
 * Get user wallet information
 */
export async function getWallet(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        wallet_balance,
        platform_credit,
        account_weight,
        total_sales,
        successful_transactions,
        last_sale_at,
        is_payout_frozen,
        fraud_flags,
        referral_earnings,
        total_referral_credits
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Calculate daily limit
    const dailyLimit = await calculateDailyLimit(userId);

    return {
      wallet_balance: data.wallet_balance || 0,
      platform_credit: data.platform_credit || 0,
      account_weight: data.account_weight || 0.3,
      total_sales: data.total_sales || 0,
      successful_transactions: data.successful_transactions || 0,
      last_sale_at: data.last_sale_at,
      is_payout_frozen: data.is_payout_frozen || false,
      fraud_flags: data.fraud_flags || [],
      referral_earnings: data.referral_earnings || 0,
      total_referral_credits: data.total_referral_credits || 0,
      daily_limit: dailyLimit,
    };
  } catch (error) {
    console.error('Wallet service getWallet error:', error);
    throw error;
  }
}

/**
 * Add funds to seller wallet (after successful order)
 */
export async function addToWallet(userId, amount, reason = 'Sale earning') {
  try {
    // Use the database function
    const { data, error } = await supabase.rpc('update_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_type: 'credit',
      p_ref_id: null,
      p_ref_type: reason,
    });

    if (error) throw error;

    return {
      success: true,
      new_balance: amount, // The actual new balance would require a separate query
    };
  } catch (error) {
    console.error('Wallet service addToWallet error:', error);
    throw error;
  }
}

/**
 * Deduct funds from wallet (for payouts)
 */
export async function deductFromWallet(userId, amount, reason = 'Withdrawal') {
  try {
    // Use the database function
    const { data, error } = await supabase.rpc('update_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_type: 'debit',
      p_ref_id: null,
      p_ref_type: reason,
    });

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error) {
    console.error('Wallet service deductFromWallet error:', error);
    throw error;
  }
}

/**
 * Add platform credit (from referrals)
 */
export async function addPlatformCredit(userId, amount, rewardType = 'referral_bonus') {
  try {
    // Get current credit
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('platform_credit, total_referral_credits, referral_earnings')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const newCredit = (user.platform_credit || 0) + amount;
    const newTotalCredits = (user.total_referral_credits || 0) + amount;
    const newEarnings = (user.referral_earnings || 0) + amount;

    // Update credit
    const { error: updateError } = await supabase
      .from('users')
      .update({
        platform_credit: newCredit,
        total_referral_credits: newTotalCredits,
        referral_earnings: newEarnings,
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    return {
      success: true,
      new_credit: newCredit,
    };
  } catch (error) {
    console.error('Wallet service addPlatformCredit error:', error);
    throw error;
  }
}

/**
 * Use platform credit for purchase
 */
export async function usePlatformCredit(userId, amount) {
  try {
    // Get current credit
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('platform_credit')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const availableCredit = user.platform_credit || 0;

    // Calculate credit to use
    const creditUsed = Math.min(availableCredit, amount);
    const newCredit = availableCredit - creditUsed;

    // Update credit
    const { error: updateError } = await supabase
      .from('users')
      .update({
        platform_credit: newCredit,
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    return {
      success: true,
      credit_used: creditUsed,
      remaining_credit: newCredit,
    };
  } catch (error) {
    console.error('Wallet service usePlatformCredit error:', error);
    throw error;
  }
}

/**
 * Calculate daily withdrawal limit
 */
export async function calculateDailyLimit(userId) {
  try {
    // Get user wallet and weight
    const { data: user, error } = await supabase
      .from('users')
      .select('wallet_balance, account_weight')
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Get withdrawal percentage from settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'withdrawal_percentage')
      .single();

    const withdrawalPercentage = settings ? parseFloat(settings.value) : 0.5;

    // Get already withdrawn today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayWithdrawals } = await supabase
      .from('payouts')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', today.toISOString());

    const alreadyWithdrawn = todayWithdrawals?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;

    // Calculate limit
    const walletBalance = user.wallet_balance || 0;
    const accountWeight = user.account_weight || 0.3;
    const maxLimit = walletBalance * accountWeight * withdrawalPercentage;
    const availableLimit = maxLimit - alreadyWithdrawn;

    return Math.max(0, availableLimit);
  } catch (error) {
    console.error('Wallet service calculateDailyLimit error:', error);
    // Return default on error
    return 0;
  }
}

/**
 * Calculate account weight based on sales
 */
export function calculateAccountWeight(totalSales, successfulTransactions) {
  let weight = 0.3; // Default for new accounts

  if (totalSales >= 1000) {
    weight = 1.0;
  } else if (totalSales >= 200) {
    weight = 0.6;
  }

  return weight;
}

/**
 * Check if user can withdraw
 */
export async function canWithdraw(userId, amount) {
  try {
    const wallet = await getWallet(userId);

    // Check if frozen
    if (wallet.is_payout_frozen) {
      return { canWithdraw: false, reason: 'Account is frozen' };
    }

    // Check fraud flags
    if (wallet.fraud_flags && wallet.fraud_flags.length > 0) {
      return { canWithdraw: false, reason: 'Account has fraud flags' };
    }

    // Check minimum withdrawal
    const minWithdrawal = 20; // Default from your spec

    if (amount < minWithdrawal) {
      return { canWithdraw: false, reason: `Minimum withdrawal is GHS ${minWithdrawal}` };
    }

    // Check balance
    if (amount > wallet.wallet_balance) {
      return { canWithdraw: false, reason: 'Insufficient balance' };
    }

    // Check daily limit
    if (amount > wallet.daily_limit) {
      return {
        canWithdraw: false,
        reason: `Daily limit exceeded. Maximum: GHS ${wallet.daily_limit.toFixed(2)}`,
      };
    }

    return { canWithdraw: true, reason: null };
  } catch (error) {
    console.error('Wallet service canWithdraw error:', error);
    return { canWithdraw: false, reason: 'Error checking withdrawal eligibility' };
  }
}

/**
 * Request payout (uses database function)
 */
export async function requestPayout(userId, amount, momoNumber, network) {
  try {
    const { data, error } = await supabase.rpc('request_payout', {
      p_user_id: userId,
      p_amount: amount,
      p_momo: momoNumber,
      p_network: network,
    });

    if (error) throw error;

    return {
      success: true,
      payout_id: data,
    };
  } catch (error) {
    console.error('Wallet service requestPayout error:', error);
    throw error;
  }
}

/**
 * Validate withdrawal (uses database function)
 */
export async function validateWithdrawal(userId, amount) {
  try {
    const { data, error } = await supabase.rpc('validate_withdrawal', {
      p_user_id: userId,
      p_amount: amount,
    });

    if (error) throw error;

    return { valid: true };
  } catch (error) {
    console.error('Wallet service validateWithdrawal error:', error);
    return { valid: false, reason: error.message };
  }
}

/**
 * Get platform statistics (admin)
 */
export async function getPlatformFinancialStats() {
  try {
    // Get all user wallet totals
    const { data: users } = await supabase
      .from('users')
      .select('wallet_balance, platform_credit');

    const totalWalletBalance = users?.reduce((sum, u) => sum + (u.wallet_balance || 0), 0) || 0;
    const totalPlatformCredit = users?.reduce((sum, u) => sum + (u.platform_credit || 0), 0) || 0;

    // Get transaction stats
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, commission, seller_earning')
      .eq('status', 'paid');

    const totalTransactionVolume = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const totalCommission = transactions?.reduce((sum, t) => sum + (t.commission || 0), 0) || 0;

    // Get pending payouts
    const { data: pendingPayouts } = await supabase
      .from('payouts')
      .select('amount')
      .eq('status', 'pending');

    const pendingPayoutTotal = pendingPayouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Get completed payouts
    const { data: completedPayouts } = await supabase
      .from('payouts')
      .select('amount')
      .eq('status', 'completed');

    const totalPayouts = completedPayouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    return {
      total_wallet_balance: totalWalletBalance,
      total_platform_credit: totalPlatformCredit,
      total_transaction_volume: totalTransactionVolume,
      total_commission: totalCommission,
      pending_payouts: pendingPayoutTotal,
      total_payouts: totalPayouts,
      // Platform profit = Commission - (this is what stays in Paystack)
      platform_profit: totalCommission,
      // Seller liability = Total wallet balance
      seller_liability: totalWalletBalance,
    };
  } catch (error) {
    console.error('Wallet service getPlatformFinancialStats error:', error);
    throw error;
  }
}

/**
 * Get wallet ledger/history for a user
 */
export async function getWalletLedger(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('wallet_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Wallet service getWalletLedger error:', error);
    throw error;
  }
}

export default {
  getWallet,
  addToWallet,
  deductFromWallet,
  addPlatformCredit,
  usePlatformCredit,
  calculateDailyLimit,
  calculateAccountWeight,
  canWithdraw,
  requestPayout,
  validateWithdrawal,
  getPlatformFinancialStats,
  getWalletLedger,
};
