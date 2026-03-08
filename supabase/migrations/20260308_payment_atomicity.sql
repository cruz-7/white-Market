-- Atomic payment settlement helpers for White Market
-- Run after 20260307_security_hardening.sql

create or replace function public.apply_order_payment(
  p_order_id uuid,
  p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_order_amount numeric(12, 2);
  v_commission numeric(12, 2);
  v_seller_earnings numeric(12, 2);
  v_pending_after numeric(12, 2);
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'status', 404,
      'error', 'Order not found'
    );
  end if;

  if v_order.status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'order_id', v_order.id
    );
  end if;

  if v_order.status = 'cancelled' then
    return jsonb_build_object(
      'ok', false,
      'status', 400,
      'error', 'Cancelled order cannot be marked paid'
    );
  end if;

  update public.orders
  set
    status = 'paid',
    paid_at = now(),
    payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = v_order.id;

  v_order_amount := coalesce(v_order.amount, 0);
  v_commission := round(v_order_amount * 0.10, 2);
  v_seller_earnings := round(v_order_amount - v_commission, 2);

  if v_order.seller_id is not null then
    insert into public.wallets (user_id, balance, pending_earnings, currency)
    values (v_order.seller_id, 0, 0, 'GHS')
    on conflict (user_id) do nothing;

    update public.wallets
    set
      pending_earnings = pending_earnings + v_seller_earnings,
      updated_at = now()
    where user_id = v_order.seller_id
    returning pending_earnings into v_pending_after;

    insert into public.wallet_transactions (
      user_id,
      type,
      amount,
      description,
      reference_id,
      balance_after
    )
    values (
      v_order.seller_id,
      'pending',
      v_seller_earnings,
      format('Order payment - %s GHS (10%% commission applied)', v_order_amount),
      v_order.id::text,
      coalesce(v_pending_after, v_seller_earnings)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'order_id', v_order.id,
    'commission', v_commission,
    'seller_earnings', v_seller_earnings
  );
end;
$$;

create or replace function public.pay_order_with_wallet(
  p_order_id uuid,
  p_buyer_id uuid,
  p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_buyer_wallet public.wallets%rowtype;
  v_order_amount numeric(12, 2);
  v_new_buyer_balance numeric(12, 2);
  v_commission numeric(12, 2);
  v_seller_earnings numeric(12, 2);
  v_pending_after numeric(12, 2);
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'status', 404,
      'error', 'Order not found'
    );
  end if;

  if v_order.buyer_id <> p_buyer_id then
    return jsonb_build_object(
      'ok', false,
      'status', 403,
      'error', 'Only the buyer can pay this order'
    );
  end if;

  insert into public.wallets (user_id, balance, pending_earnings, currency)
  values (p_buyer_id, 0, 0, 'GHS')
  on conflict (user_id) do nothing;

  select *
  into v_buyer_wallet
  from public.wallets
  where user_id = p_buyer_id
  for update;

  if v_order.status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'order_id', v_order.id,
      'balance', coalesce(v_buyer_wallet.balance, 0)
    );
  end if;

  if v_order.status = 'cancelled' then
    return jsonb_build_object(
      'ok', false,
      'status', 400,
      'error', 'Cancelled order cannot be paid'
    );
  end if;

  v_order_amount := coalesce(v_order.amount, 0);
  if v_order_amount <= 0 then
    return jsonb_build_object(
      'ok', false,
      'status', 400,
      'error', 'Invalid order amount'
    );
  end if;

  if coalesce(v_buyer_wallet.balance, 0) < v_order_amount then
    return jsonb_build_object(
      'ok', false,
      'status', 400,
      'error', 'Insufficient wallet balance'
    );
  end if;

  v_new_buyer_balance := round(v_buyer_wallet.balance - v_order_amount, 2);

  update public.wallets
  set
    balance = v_new_buyer_balance,
    updated_at = now()
  where user_id = p_buyer_id;

  insert into public.wallet_transactions (
    user_id,
    type,
    amount,
    description,
    reference_id,
    balance_after
  )
  values (
    p_buyer_id,
    'debit',
    v_order_amount,
    format('Wallet payment for order %s', v_order.id),
    v_order.id::text,
    v_new_buyer_balance
  );

  update public.orders
  set
    status = 'paid',
    paid_at = now(),
    payment_reference = coalesce(p_payment_reference, payment_reference)
  where id = v_order.id;

  v_commission := round(v_order_amount * 0.10, 2);
  v_seller_earnings := round(v_order_amount - v_commission, 2);

  if v_order.seller_id is not null then
    insert into public.wallets (user_id, balance, pending_earnings, currency)
    values (v_order.seller_id, 0, 0, 'GHS')
    on conflict (user_id) do nothing;

    update public.wallets
    set
      pending_earnings = pending_earnings + v_seller_earnings,
      updated_at = now()
    where user_id = v_order.seller_id
    returning pending_earnings into v_pending_after;

    insert into public.wallet_transactions (
      user_id,
      type,
      amount,
      description,
      reference_id,
      balance_after
    )
    values (
      v_order.seller_id,
      'pending',
      v_seller_earnings,
      format('Order payment - %s GHS (10%% commission applied)', v_order_amount),
      v_order.id::text,
      coalesce(v_pending_after, v_seller_earnings)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'order_id', v_order.id,
    'balance', v_new_buyer_balance,
    'commission', v_commission,
    'seller_earnings', v_seller_earnings
  );
end;
$$;
