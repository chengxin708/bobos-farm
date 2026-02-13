-- Bobos Farm Menu Seed Data
-- Run this after the schema is created

-- ==================== Menu Categories ====================
-- Categories: Appetizers, Main Dishes, Desserts, Beverages (in Chinese: 开胃菜, 主菜, 甜点, 饮料)

INSERT INTO "menu_categories" ("name", "description", "sort_order") VALUES
('Appetizers', 'Start your meal with these delicious starters', 1),
('Main Dishes', 'Hearty main courses to satisfy your appetite', 2),
('Desserts', 'Sweet treats to end your meal', 3),
('Beverages', 'Refreshing drinks to accompany your meal', 4)
ON CONFLICT DO NOTHING;

-- ==================== Menu Items ====================

-- Appetizers (5 items)
INSERT INTO "menu_items" ("category_id", "name", "description", "price", "available") VALUES
(1, 'Spring Rolls', 'Crispy vegetable spring rolls with sweet chili sauce', 8.99, true),
(1, 'Dumplings (6pcs)', 'Steamed pork and vegetable dumplings', 10.99, true),
(1, 'Spicy Cucumber Salad', 'Refreshing cucumber with garlic and chili oil', 6.99, true),
(1, 'Fried Calamari', 'Crispy fried squid rings with tartar sauce', 12.99, true),
(1, 'Mongolian Beef Skewers', 'Grilled beef with Mongolian spices', 14.99, true)
ON CONFLICT DO NOTHING;

-- Main Dishes (5 items)
INSERT INTO "menu_items" ("category_id", "name", "description", "price", "available") VALUES
(2, 'Kung Pao Chicken', 'Spicy stir-fried chicken with peanuts and vegetables', 18.99, true),
(2, 'Beijing Roast Duck', 'Traditional roasted duck with pancakes and hoisin sauce', 38.99, true),
(2, 'Mongolian Hot Pot', 'Rich broth with lamb, beef, and fresh vegetables', 32.99, true),
(2, 'Sweet and Sour Pork', 'Crispy pork in tangy sweet and sour sauce', 17.99, true),
(2, 'Beef Broccoli', 'Tender beef with fresh broccoli in savory sauce', 19.99, true)
ON CONFLICT DO NOTHING;

-- Desserts (4 items)
INSERT INTO "menu_items" ("category_id", "name", "description", "price", "available") VALUES
(3, 'Mango Pudding', 'Smooth mango pudding with coconut milk', 6.99, true),
(3, 'Fried Ice Cream', 'Crispy outer shell with cold ice cream inside', 8.99, true),
(3, 'Red Bean Soup', 'Sweet red bean soup with glutinous rice balls', 5.99, true),
(3, 'Egg Tarts (4pcs)', 'Flaky pastry with creamy egg custard', 7.99, true)
ON CONFLICT DO NOTHING;

-- Beverages (5 items)
INSERT INTO "menu_items" ("category_id", "name", "description", "price", "available") VALUES
(4, 'Jasmine Tea', 'Fragrant jasmine green tea', 3.99, true),
(4, 'Bubble Tea', 'Classic milk tea with tapioca pearls', 5.99, true),
(4, 'Lychee Juice', 'Fresh lychee fruit juice', 4.99, true),
(4, 'Thai Iced Tea', 'Sweet Thai tea with condensed milk', 4.99, true),
(4, 'Sparkling Water', 'Refreshing sparkling mineral water', 2.99, true)
ON CONFLICT DO NOTHING;
