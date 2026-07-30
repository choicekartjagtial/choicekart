-- Add fit column to banners table
-- Run this in Supabase SQL Editor
ALTER TABLE banners ADD COLUMN IF NOT EXISTS fit TEXT DEFAULT 'contain';
