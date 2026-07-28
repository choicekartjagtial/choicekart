-- ============================================
-- CHOICE KART - Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor
-- This seeds categories and all existing products
-- ============================================

-- ===== CATEGORIES =====
INSERT INTO categories (id, name, slug, sort_order, is_active) VALUES
('c1000001-0000-0000-0000-000000000001', 'Grocery & Staples', 'grocery', 1, true),
('c1000001-0000-0000-0000-000000000002', 'Fruits', 'fruits', 2, true),
('c1000001-0000-0000-0000-000000000003', 'Vegetables', 'vegetables', 3, true),
('c1000001-0000-0000-0000-000000000004', 'Dairy & Eggs', 'dairy', 4, true),
('c1000001-0000-0000-0000-000000000005', 'Snacks & Munchies', 'snacks', 5, true),
('c1000001-0000-0000-0000-000000000006', 'Beverages', 'beverages', 6, true),
('c1000001-0000-0000-0000-000000000007', 'Household', 'household', 7, true);

-- ===== PRODUCTS =====
-- Grocery & Staples
INSERT INTO products (name, slug, brand, category_id, mrp, selling_price, unit, unit_value, stock_qty, image_url, is_active, is_featured) VALUES
('Aashirvaad Whole Wheat Atta', 'aashirvaad-whole-wheat-atta', 'Aashirvaad', 'c1000001-0000-0000-0000-000000000001', 310, 265, 'kg', 5, 100, 'assets/images/products/flour/aashirvaad-whole-wheat-atta.jpg', true, true),
('India Gate Basmati Rice - Super', 'india-gate-basmati-rice-super', 'India Gate', 'c1000001-0000-0000-0000-000000000001', 999, 899, 'kg', 5, 80, 'assets/images/downloads/India Gate Basmati Rice - Super.jpg', true, true),
('Fortune Sunlite Refined Sunflower Oil', 'fortune-sunlite-refined-sunflower-oil', 'Fortune', 'c1000001-0000-0000-0000-000000000001', 210, 176, 'liter', 1, 120, 'assets/images/downloads/Fortune Sunlite Refined Sunflower Oil.jpg', true, true),
('Tata Salt - Iodised', 'tata-salt-iodised', 'Tata', 'c1000001-0000-0000-0000-000000000001', 28, 20, 'kg', 1, 200, 'assets/images/downloads/Tata Salt - Iodised.jpg', true, false),
('Tata Sampann Toor Dal / Arhar Dal', 'tata-sampann-toor-dal', 'Tata Sampann', 'c1000001-0000-0000-0000-000000000001', 145, 115, 'kg', 1, 90, 'assets/images/downloads/Tata Sampann Toor DalArhar Dal.jpg', true, true),
('Aashirvaad Sugar', 'aashirvaad-sugar', 'Aashirvaad', 'c1000001-0000-0000-0000-000000000001', 50, 42, 'kg', 1, 150, 'assets/images/downloads/Aashirvaad Sugar.jpg', true, false),
('MDH Garam Masala', 'mdh-garam-masala', 'MDH', 'c1000001-0000-0000-0000-000000000001', 99, 85, 'g', 100, 60, 'assets/images/products/spices/mdh-garam-masala.jpg', true, false),
('Saffola Gold Oil', 'saffola-gold-oil', 'Saffola', 'c1000001-0000-0000-0000-000000000001', 235, 199, 'liter', 1, 70, 'assets/images/products/oils/saffola-gold-oil.jpg', true, false),
('Everest Kashmiri Lal Chilli', 'everest-kashmiri-lal-chilli', 'Everest', 'c1000001-0000-0000-0000-000000000001', 95, 78, 'g', 100, 50, 'assets/images/products/spices/everest-kashmirilal-chilli.jpg', true, false),
('Rajdhani Besan (Gram Flour)', 'rajdhani-besan-gram-flour', 'Rajdhani', 'c1000001-0000-0000-0000-000000000001', 80, 68, 'g', 500, 80, 'assets/images/products/flour/rajdhani-besan-gram-flour.jpg', true, false),
('California Almonds (Badam)', 'california-almonds-badam', 'Premium', 'c1000001-0000-0000-0000-000000000001', 399, 320, 'g', 250, 40, 'assets/images/products/dryfruits/california-almonds-badam.jpg', true, true),
('Dabur Honey', 'dabur-honey', 'Dabur', 'c1000001-0000-0000-0000-000000000001', 250, 199, 'g', 500, 45, 'assets/images/products/sugar/dabur-honey.jpg', true, false),

-- Vegetables
('Fresh Tomato - Hybrid, Organically Grown', 'fresh-tomato-hybrid', 'Farm Fresh', 'c1000001-0000-0000-0000-000000000003', 60, 42, 'kg', 1, 200, 'assets/images/downloads/Fresh Tomato - Hybrid, Organically Grown.jpg', true, true),
('Fresh Onion - Premium Quality', 'fresh-onion-premium', 'Farm Fresh', 'c1000001-0000-0000-0000-000000000003', 50, 35, 'kg', 1, 200, 'assets/images/downloads/Fresh Onion - Premium Quality.jpg', true, false),
('Fresh Potato - Premium', 'fresh-potato-premium', 'Farm Fresh', 'c1000001-0000-0000-0000-000000000003', 45, 32, 'kg', 1, 200, 'assets/images/downloads/Fresh Potato - Premium.jpg', true, false),
('Green Chilli - Hot & Fresh', 'green-chilli-hot-fresh', 'Farm Fresh', 'c1000001-0000-0000-0000-000000000003', 40, 30, 'g', 250, 150, 'assets/images/downloads/Green Chilli - Hot & Fresh.jpg', true, false),

-- Fruits
('Apple - Shimla, Premium', 'apple-shimla-premium', 'Fresho', 'c1000001-0000-0000-0000-000000000002', 220, 180, 'kg', 1, 60, 'assets/images/downloads/Apple - Shimla, Premium.jpg', true, true),
('Fresh Banana - Robusta', 'fresh-banana-robusta', 'Farm Fresh', 'c1000001-0000-0000-0000-000000000002', 60, 49, 'dozen', 1, 100, 'assets/images/downloads/Fresh Banana - Robusta.jpg', true, false),
('Pomegranate - Fresh & Juicy', 'pomegranate-fresh-juicy', 'Fresho', 'c1000001-0000-0000-0000-000000000002', 199, 160, 'kg', 1, 50, 'assets/images/downloads/Pomegranate - Fresh & Juicy.jpg', true, true),

-- Dairy
('Amul Taaza Toned Fresh Milk', 'amul-taaza-toned-fresh-milk', 'Amul', 'c1000001-0000-0000-0000-000000000004', 32, 29, 'ml', 500, 200, 'assets/images/downloads/Amul Taaza Toned Fresh Milk.jpg', true, true),
('Amul Pasteurised Butter', 'amul-pasteurised-butter', 'Amul', 'c1000001-0000-0000-0000-000000000004', 60, 56, 'g', 100, 80, 'assets/images/downloads/Amul Pasteurised Butter.jpg', true, false),
('Amul Paneer - Fresh', 'amul-paneer-fresh', 'Amul', 'c1000001-0000-0000-0000-000000000004', 105, 90, 'g', 200, 40, 'assets/images/products/dairy/amul-paneer.jpg', true, false),
('Heritage Curd', 'heritage-curd', 'Heritage', 'c1000001-0000-0000-0000-000000000004', 35, 30, 'g', 400, 60, 'assets/images/products/dairy/heritage-curd.jpg', true, false),

-- Snacks
('Lay''s Potato Chips - Classic Salted', 'lays-potato-chips-classic-salted', 'Lay''s', 'c1000001-0000-0000-0000-000000000005', 20, 20, 'g', 52, 150, 'assets/images/downloads/Lay''s Potato Chips - Classic Salted.jpg', true, false),
('Maggi 2-Minute Noodles', 'maggi-2-minute-noodles', 'Maggi', 'c1000001-0000-0000-0000-000000000005', 14, 14, 'g', 70, 200, 'assets/images/products/snacks/maggi-2-minute-noodles.jpg', true, true),
('Haldiram''s Aloo Bhujia', 'haldirams-aloo-bhujia', 'Haldiram''s', 'c1000001-0000-0000-0000-000000000005', 85, 75, 'g', 200, 80, 'assets/images/products/snacks/haldiram-aloo-bhujia.jpg', true, false),
('Kurkure Masala Munch', 'kurkure-masala-munch', 'Kurkure', 'c1000001-0000-0000-0000-000000000005', 20, 20, 'g', 75, 150, 'assets/images/products/snacks/kurkure-masala-munch.jpg', true, false),
('Cadbury Dairy Milk', 'cadbury-dairy-milk', 'Cadbury', 'c1000001-0000-0000-0000-000000000005', 50, 50, 'g', 50, 100, 'assets/images/products/snacks/cadbury-dairy-milk.jpg', true, false),

-- Beverages
('Bru Instant Coffee', 'bru-instant-coffee', 'Bru', 'c1000001-0000-0000-0000-000000000006', 135, 110, 'g', 50, 60, 'assets/images/downloads/Bru Instant Coffee.jpg', true, false),
('Tata Tea Premium - Rich & Aromatic', 'tata-tea-premium', 'Tata Tea', 'c1000001-0000-0000-0000-000000000006', 150, 129, 'g', 250, 80, 'assets/images/downloads/Tata Tea Premium - Rich & Aromatic.jpg', true, true),
('Coca-Cola', 'coca-cola', 'Coca-Cola', 'c1000001-0000-0000-0000-000000000006', 40, 40, 'ml', 750, 100, 'assets/images/products/beverages/coca-cola.jpg', true, false),
('Bournvita Health Drink', 'bournvita-health-drink', 'Cadbury', 'c1000001-0000-0000-0000-000000000006', 275, 235, 'g', 500, 50, 'assets/images/downloads/Bournvita Health Drink.jpg', true, false),
('Taj Mahal Tea', 'taj-mahal-tea', 'Brooke Bond', 'c1000001-0000-0000-0000-000000000006', 170, 145, 'g', 250, 60, 'assets/images/downloads/Taj Mahal Tea.jpg', true, false),

-- Household
('Surf Excel Matic Top Load Detergent', 'surf-excel-matic-top-load', 'Surf Excel', 'c1000001-0000-0000-0000-000000000007', 280, 235, 'kg', 1, 70, 'assets/images/downloads/Surf Excel Matic Top Load Detergent.jpg', true, true),
('Vim Dishwash Liquid Gel - Lemon', 'vim-dishwash-liquid-gel-lemon', 'Vim', 'c1000001-0000-0000-0000-000000000007', 110, 95, 'ml', 500, 80, 'assets/images/downloads/Vim Dishwash Liquid Gel - Lemon.jpg', true, false);
