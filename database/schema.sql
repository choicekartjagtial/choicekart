-- ============================================
-- CHOICE KART - Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- ===== 1. ADMIN USERS =====
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT 'admin123',
    phone TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 2. CATEGORIES =====
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_te TEXT, -- Telugu name
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 3. SUBCATEGORIES =====
CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_te TEXT,
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 4. PRODUCTS =====
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_te TEXT,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    category_id UUID NOT NULL REFERENCES categories(id),
    subcategory_id UUID REFERENCES subcategories(id),
    image_url TEXT,
    images TEXT[] DEFAULT '{}', -- multiple images
    mrp NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'piece' CHECK (unit IN ('piece', 'kg', 'g', 'liter', 'ml', 'pack', 'dozen', 'bundle')),
    unit_value NUMERIC(10,2) DEFAULT 1,
    stock_qty INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    brand TEXT,
    barcode TEXT,
    hsn_code TEXT, -- for GST
    gst_percent NUMERIC(4,2) DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 5. CUSTOMERS =====
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE, -- links to Supabase auth.users
    name TEXT,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    addresses JSONB DEFAULT '[]',
    default_address_index INT DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES customers(id),
    wallet_balance NUMERIC(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 6. DELIVERY BOYS =====
CREATE TABLE delivery_boys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    vehicle_type TEXT DEFAULT 'bike',
    vehicle_number TEXT,
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    current_lat NUMERIC(10,7),
    current_lng NUMERIC(10,7),
    total_deliveries INT DEFAULT 0,
    rating NUMERIC(3,2) DEFAULT 5.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 7. ORDERS =====
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    delivery_boy_id UUID REFERENCES delivery_boys(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'returned')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cod', 'upi', 'card', 'wallet')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_id TEXT, -- razorpay/stripe payment id
    delivery_address JSONB NOT NULL,
    delivery_distance_km NUMERIC(5,2),
    delivery_charge NUMERIC(10,2) DEFAULT 0,
    subtotal NUMERIC(10,2) NOT NULL,
    discount NUMERIC(10,2) DEFAULT 0,
    coupon_code TEXT,
    gst_amount NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,
    notes TEXT,
    delivery_lat NUMERIC(10,7),
    delivery_lng NUMERIC(10,7),
    estimated_delivery TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    invoice_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 8. ORDER ITEMS =====
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_image TEXT,
    quantity INT NOT NULL,
    unit TEXT NOT NULL,
    unit_value NUMERIC(10,2),
    mrp NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    gst_percent NUMERIC(4,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 9. CART =====
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(customer_id, product_id)
);

-- ===== 10. WISHLIST =====
CREATE TABLE wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(customer_id, product_id)
);

-- ===== 11. COUPONS =====
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL,
    min_order_amount NUMERIC(10,2) DEFAULT 0,
    max_discount NUMERIC(10,2),
    usage_limit INT,
    used_count INT DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 12. BANNERS =====
CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    link_url TEXT,
    position TEXT DEFAULT 'home' CHECK (position IN ('home', 'category', 'offer', 'popup')),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT now(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 13. DELIVERY CHARGES =====
CREATE TABLE delivery_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_distance_km NUMERIC(5,2) NOT NULL,
    max_distance_km NUMERIC(5,2) NOT NULL,
    charge NUMERIC(10,2) NOT NULL,
    free_above_amount NUMERIC(10,2), -- free delivery above this order amount
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 14. SERVICE AREAS (PINCODES) =====
CREATE TABLE service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pincode TEXT NOT NULL,
    area_name TEXT NOT NULL,
    city TEXT DEFAULT 'Jagtial',
    state TEXT DEFAULT 'Telangana',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 15. NOTIFICATIONS =====
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'order', 'offer', 'delivery')),
    target TEXT DEFAULT 'all' CHECK (target IN ('all', 'customer', 'delivery_boy')),
    target_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 16. STORE SETTINGS =====
CREATE TABLE store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default delivery charges (free within 3 KM)
INSERT INTO delivery_charges (min_distance_km, max_distance_km, charge, free_above_amount) VALUES
(0, 3, 0, NULL),
(3, 5, 30, 499),
(5, 8, 50, 999);

-- Default store settings
INSERT INTO store_settings (key, value) VALUES
('store_name', 'Choice Kart'),
('store_phone', '9666991993'),
('store_email', 'choicekart@gmail.com'),
('store_address', 'Jagtial, Telangana'),
('store_lat', '18.7915'),
('store_lng', '78.9126'),
('delivery_radius_km', '5'),
('min_order_amount', '99'),
('gst_number', ''),
('currency', 'INR'),
('opening_time', '09:00'),
('closing_time', '19:00');

-- Default admin user (owner) — CHANGE PASSWORD after first login!
INSERT INTO admin_users (name, email, password, phone, role) VALUES
('Thirumal Goud', 'admin@choicekart.com', 'admin123', '9666991993', 'owner');

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_subcategory ON products(subcategory_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_delivery_boy ON orders(delivery_boy_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_cart_customer ON cart_items(customer_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_subcategories_category ON subcategories(category_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_auth ON customers(auth_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_boys ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ policies (for customer website)
CREATE POLICY "Public can read active categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read active subcategories" ON subcategories FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read active products" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read active banners" ON banners FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read active coupons" ON coupons FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read delivery charges" ON delivery_charges FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read service areas" ON service_areas FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read store settings" ON store_settings FOR SELECT USING (true);

-- ADMIN full access policies (using service role or authenticated admin)
-- For now, allow all operations for authenticated users (we'll tighten later)
CREATE POLICY "Admin full access categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access subcategories" ON subcategories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access delivery_boys" ON delivery_boys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access cart_items" ON cart_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access wishlist" ON wishlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access coupons" ON coupons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access banners" ON banners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access delivery_charges" ON delivery_charges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access service_areas" ON service_areas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access store_settings" ON store_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access admin_users" ON admin_users FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER tr_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_subcategories_updated_at BEFORE UPDATE ON subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_delivery_boys_updated_at BEFORE UPDATE ON delivery_boys FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_banners_updated_at BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number = 'CK' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
CREATE TRIGGER tr_orders_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();
