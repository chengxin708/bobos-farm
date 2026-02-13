-- Create yurts table
CREATE TABLE IF NOT EXISTS yurts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 4,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create menu_categories table
CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2), -- NULL until booking is confirmed
  image_url VARCHAR(500),
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES menu_categories(id)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  total_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  menu_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  yurt_id INTEGER NOT NULL,
  booking_date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL, -- 'afternoon' or 'evening'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (yurt_id) REFERENCES yurts(id)
);

-- Insert default yurts data
INSERT INTO yurts (name, color, description, capacity, price, image_url) VALUES
  ('White Yurt', 'white', 'A peaceful white蒙古包, perfect for families seeking tranquility. Features traditional Mongolian design with modern amenities.', 4, 288, '/yurts/white.svg'),
  ('Red Yurt', 'red', 'An energetic red蒙古包, great for celebrations and group activities. Spacious interior with vibrant decor.', 6, 388, '/yurts/red.svg'),
  ('Yellow Yurt', 'yellow', 'A warm yellow蒙古包, ideal for romantic getaways. Cozy atmosphere with golden hour views.', 2, 198, '/yurts/yellow.svg')
ON CONFLICT DO NOTHING;

-- Insert menu categories
INSERT INTO menu_categories (name, description, sort_order) VALUES
  ('Appetizers', 'Start your meal with our delicious appetizers', 1),
  ('Main Courses', 'Hearty main dishes to satisfy your appetite', 2),
  ('Desserts', 'Sweet treats to end your meal', 3),
  ('Beverages', 'Refreshing drinks and beverages', 4)
ON CONFLICT DO NOTHING;

-- Insert menu items (prices included - will only be shown after booking confirmation)
INSERT INTO menu_items (category_id, name, description, price, available) VALUES
  -- Appetizers
  (1, 'Spring Rolls', 'Crispy vegetable spring rolls with sweet chili sauce', 28, true),
  (1, 'Bruschetta', 'Toasted bread with fresh tomatoes, basil, and garlic', 22, true),
  (1, 'Soup of the Day', 'Chef''s daily homemade soup', 18, true),
  (1, 'Caesar Salad', 'Romaine lettuce with Caesar dressing and croutons', 32, true),
  (1, 'Cheese Platter', 'Selection of local and international cheeses', 48, true),
  
  -- Main Courses
  (2, 'Grilled Chicken', 'Free-range chicken with herbs and vegetables', 68, true),
  (2, 'Beef Steak', 'Premium beef steak with mashed potatoes', 98, true),
  (2, 'Fish & Chips', 'Fresh catch with crispy chips and tartar sauce', 58, true),
  (2, 'Vegetarian Pasta', 'Pasta with seasonal vegetables in olive oil', 48, true),
  (2, 'Lamb Curry', 'Traditional lamb curry with rice', 78, true),
  
  -- Desserts
  (3, 'Chocolate Cake', 'Rich chocolate cake with whipped cream', 28, true),
  (3, 'Tiramisu', 'Classic Italian coffee-flavored dessert', 32, true),
  (3, 'Fruit Salad', 'Fresh seasonal fruits', 22, true),
  (3, 'Ice Cream', 'Choice of vanilla, chocolate, or strawberry', 18, true),
  (3, 'Cheesecake', 'Creamy cheesecake with berry sauce', 32, true),
  
  -- Beverages
  (4, 'Fresh Orange Juice', 'Freshly squeezed orange juice', 18, true),
  (4, 'Coffee', 'Regular or espresso', 15, true),
  (4, 'Tea', 'Green, black, or herbal tea', 12, true),
  (4, 'Soft Drinks', 'Coke, Sprite, or Fanta', 12, true),
  (4, 'Wine', 'Selection of red or white wine by glass', 38, true)
ON CONFLICT DO NOTHING;
