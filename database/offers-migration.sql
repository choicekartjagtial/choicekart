-- ============================================
-- CHOICE KART — Offers/Deals Table
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    offer_value TEXT NOT NULL,          -- e.g. "FLAT ₹200 OFF", "20% OFF"
    coupon_code TEXT,                    -- optional linked coupon
    link_url TEXT,                       -- where "Shop Now" goes
    image_url TEXT,                      -- optional image (replaces colored card)
    style TEXT DEFAULT 'mega' CHECK (style IN ('mega', 'savings', 'delivery', 'festive', 'flash')),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT now(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active offers" ON offers FOR SELECT USING (is_active = true);
CREATE POLICY "Admin full access offers" ON offers FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER tr_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
