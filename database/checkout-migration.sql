-- ============================================
-- CHOICE KART — Checkout & Payment Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. OTP Codes table (for phone OTP login)
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert otp" ON otp_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read otp" ON otp_codes FOR SELECT USING (true);
CREATE POLICY "Public can update otp" ON otp_codes FOR UPDATE USING (true);

-- 2. Add Razorpay settings
INSERT INTO store_settings (key, value) VALUES
('razorpay_key_id', ''),
('razorpay_key_secret', '')
ON CONFLICT (key) DO NOTHING;

-- 3. Add 'online' to orders payment_method constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('cod', 'upi', 'card', 'wallet', 'online'));

-- 4. Add is_pickup column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_pickup BOOLEAN DEFAULT false;

-- 5. Clean up expired OTPs (optional — run periodically)
-- DELETE FROM otp_codes WHERE expires_at < now();
