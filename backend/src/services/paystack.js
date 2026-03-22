/**
 * Paystack Service for White Market
 * Handles all payment and payout operations
 */

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Initialize a payment/transaction
 */
export async function initializePayment(email, amount, metadata = {}) {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Convert to pesewas
        metadata,
        callback_url: metadata.callback_url || `${process.env.FRONTEND_URL}/payment/callback`,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack initializePayment error:', error);
    throw error;
  }
}

/**
 * Verify a payment using reference
 */
export async function verifyPayment(reference) {
  try {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack verifyPayment error:', error);
    throw error;
  }
}

/**
 * Create a transfer recipient for MoMo/-bank
 */
export async function createTransferRecipient(name, accountNumber, bankCode, currency = 'GHS') {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'mobile_money',
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack createTransferRecipient error:', error);
    throw error;
  }
}

/**
 * Create recipient for mobile money (Ghana)
 */
export async function createMoMoRecipient(name, phoneNumber) {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'mobile_money',
        name,
        account_number: phoneNumber,
        bank_code: 'MTN', // Default to MTN for Ghana
        currency: 'GHS',
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack createMoMoRecipient error:', error);
    throw error;
  }
}

/**
 * Send a transfer/payout to a recipient
 */
export async function sendTransfer(amount, recipientCode, reason = 'Withdrawal') {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amount * 100), // Convert to pesewas
        recipient: recipientCode,
        reason,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack sendTransfer error:', error);
    throw error;
  }
}

/**
 * Get Paystack account balance
 */
export async function getBalance() {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/balance`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack getBalance error:', error);
    throw error;
  }
}

/**
 * Get balance for specific currency
 */
export async function getBalanceForCurrency(currency = 'GHS') {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/balance/${currency}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack getBalanceForCurrency error:', error);
    throw error;
  }
}

/**
 * Check if transfer is successful
 */
export async function checkTransferStatus(transferId) {
  try {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/transfer/${transferId}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack checkTransferStatus error:', error);
    throw error;
  }
}

/**
 * List banks (for Ghana)
 */
export async function listBanks(country = 'ghana') {
  try {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/bank?country=${country}&currency=GHS`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack listBanks error:', error);
    throw error;
  }
}

/**
 * Resolve account number (for bank transfers)
 */
export async function resolveAccount(accountNumber, bankCode) {
  try {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack resolveAccount error:', error);
    throw error;
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(signature, payload) {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

/**
 * Get list of transfers
 */
export async function listTransfers(status, perPage = 50) {
  try {
    let url = `${PAYSTACK_BASE_URL}/transfer?per_page=${perPage}`;
    if (status) {
      url += `&status=${status}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack listTransfers error:', error);
    throw error;
  }
}

/**
 * Finalize payout (for manually initiated transfers)
 */
export async function finalizeTransfer(transferCode, otp) {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transfer/finalize_transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transfer_code: transferCode,
        otp,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack finalizeTransfer error:', error);
    throw error;
  }
}

export default {
  initializePayment,
  verifyPayment,
  createTransferRecipient,
  createMoMoRecipient,
  sendTransfer,
  getBalance,
  getBalanceForCurrency,
  checkTransferStatus,
  listBanks,
  resolveAccount,
  verifyWebhookSignature,
  listTransfers,
  finalizeTransfer,
};
