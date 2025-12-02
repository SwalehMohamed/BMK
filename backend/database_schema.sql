CREATE DATABASE IF NOT EXISTS binmasud_kuku;
USE binmasud_kuku;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    reset_token_hash VARCHAR(64) NULL,
    reset_token_expires DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chicks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_name VARCHAR(255) NOT NULL,
    breed VARCHAR(255) NOT NULL,
    arrival_date DATE NOT NULL,
    supplier VARCHAR(255) NOT NULL,
    initial_count INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mortality_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chick_batch_id INT NOT NULL,
    date DATE NOT NULL,
    number_dead INT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chick_batch_id) REFERENCES chicks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feeds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('starter', 'grower', 'finisher', 'layer') NOT NULL,
    quantity_kg DECIMAL(10,2) NOT NULL,
    supplier VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slaughtered (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    date DATE NOT NULL,
    quantity INT NOT NULL,
    avg_weight DECIMAL(10,3) NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE CASCADE
);

-- Product types table (normalized pricing by type)
CREATE TABLE IF NOT EXISTS product_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table (packaged items derived from slaughter batches)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    packaged_quantity INT NOT NULL DEFAULT 0,
    batch_id INT NULL,
    weight DECIMAL(10,3) NULL,
    base_unit_price DECIMAL(10,2) NULL,
    slaughtered_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE SET NULL,
    FOREIGN KEY (slaughtered_id) REFERENCES slaughtered(id) ON DELETE SET NULL
);

-- Orders table (weight-based pricing via product or product type)
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_date DATE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(100) NULL,
    product_id INT NULL,
    quantity INT NOT NULL,
    manual_unit_weight_kg DECIMAL(10,3) NULL,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0, -- price per kg
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('pending','confirmed','fulfilled','cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Deliveries table (fulfillment events for orders)
CREATE TABLE IF NOT EXISTS deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    delivery_date DATE NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    address TEXT NULL,
    quantity_delivered INT NOT NULL,
    notes TEXT NULL,
    delivered_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (delivered_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Feed usage events (stock consumption logging)
CREATE TABLE IF NOT EXISTS feed_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feed_id INT NOT NULL,
    user_id INT NULL,
    batch_id INT NULL,
    quantity_used DECIMAL(10,2) NOT NULL,
    date_used DATE NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE SET NULL
);

-- NOTE: Legacy migration helpers folded into base definitions above

CREATE INDEX idx_chicks_arrival_date ON chicks(arrival_date);
CREATE INDEX idx_mortality_date ON mortality_logs(date);
CREATE INDEX idx_feeds_expiry ON feeds(expiry_date);
CREATE INDEX idx_slaughtered_date ON slaughtered(date);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_batch ON products(batch_id);
CREATE INDEX idx_products_slaughtered ON products(slaughtered_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_product ON orders(product_id);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);
CREATE INDEX idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX idx_feed_usage_feed ON feed_usage(feed_id);
CREATE INDEX idx_feed_usage_batch ON feed_usage(batch_id);
CREATE INDEX idx_feed_usage_used_at ON feed_usage(used_at);

INSERT IGNORE INTO users (username, email, password_hash, role) 
VALUES ('admin', 'admin@bmk.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
