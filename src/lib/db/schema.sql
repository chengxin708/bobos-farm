-- Bobos Farm Database Schema (PostgreSQL)
-- This file contains the raw SQL for creating all tables

-- ==================== Users ====================
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY DEFAULT (cuid()),
    "email" TEXT UNIQUE NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "email_verified" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP DEFAULT now(),
    "updated_at" TIMESTAMP DEFAULT now()
);

-- ==================== Yurts (蒙古包) ====================
CREATE TABLE IF NOT EXISTS "yurts" (
    "id" TEXT PRIMARY KEY DEFAULT (cuid()),
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description_cn" TEXT,
    "description_en" TEXT,
    "created_at" TIMESTAMP DEFAULT now()
);

-- ==================== Bookings (预约) ====================
CREATE TABLE IF NOT EXISTS "bookings" (
    "id" TEXT PRIMARY KEY DEFAULT (cuid()),
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "yurt_id" TEXT NOT NULL REFERENCES "yurts"("id") ON DELETE CASCADE,
    "date" TIMESTAMP NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "zelle_reference" TEXT,
    "created_at" TIMESTAMP DEFAULT now(),
    "updated_at" TIMESTAMP DEFAULT now()
);

-- ==================== Menu Categories ====================
CREATE TABLE IF NOT EXISTS "menu_categories" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER DEFAULT 0
);

-- ==================== Menu Items ====================
CREATE TABLE IF NOT EXISTS "menu_items" (
    "id" SERIAL PRIMARY KEY,
    "category_id" INTEGER NOT NULL REFERENCES "menu_categories"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10, 2) NOT NULL,
    "image_url" TEXT,
    "available" BOOLEAN DEFAULT true
);

-- ==================== Orders ====================
CREATE TABLE IF NOT EXISTS "orders" (
    "id" SERIAL PRIMARY KEY,
    "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "total_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP DEFAULT now()
);

-- ==================== Order Items ====================
CREATE TABLE IF NOT EXISTS "order_items" (
    "id" SERIAL PRIMARY KEY,
    "order_id" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "menu_item_id" INTEGER NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10, 2) NOT NULL,
    "subtotal" DECIMAL(10, 2) NOT NULL
);

-- ==================== Booking Orders (legacy - for reference) ====================
CREATE TABLE IF NOT EXISTS "booking_orders" (
    "id" TEXT PRIMARY KEY DEFAULT (cuid()),
    "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
    "menu_item_id" TEXT NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
    "quantity" INTEGER DEFAULT 1,
    "price" DECIMAL(10, 2) NOT NULL,
    "created_at" TIMESTAMP DEFAULT now()
);

-- ==================== Email Verifications ====================
CREATE TABLE IF NOT EXISTS "email_verifications" (
    "id" TEXT PRIMARY KEY DEFAULT (cuid()),
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token" TEXT UNIQUE NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "used" BOOLEAN DEFAULT false
);

-- ==================== Indexes ====================
CREATE INDEX IF NOT EXISTS "idx_bookings_user_id" ON "bookings"("user_id");
CREATE INDEX IF NOT EXISTS "idx_bookings_yurt_id" ON "bookings"("yurt_id");
CREATE INDEX IF NOT EXISTS "idx_bookings_date" ON "bookings"("date");
CREATE INDEX IF NOT EXISTS "idx_menu_items_category_id" ON "menu_items"("category_id");
CREATE INDEX IF NOT EXISTS "idx_orders_booking_id" ON "orders"("booking_id");
CREATE INDEX IF NOT EXISTS "idx_orders_user_id" ON "orders"("user_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_order_id" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "idx_booking_orders_booking_id" ON "booking_orders"("booking_id");
CREATE INDEX IF NOT EXISTS "idx_email_verifications_user_id" ON "email_verifications"("user_id");
