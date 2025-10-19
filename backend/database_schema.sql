-- BinMasudKuku Farm Management Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS bmk;
USE bmk;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Chicks table
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

-- Mortality logs table
CREATE TABLE IF NOT EXISTS mortality_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chick_batch_id INT NOT NULL,
    date DATE NOT NULL,
    number_dead INT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chick_batch_id) REFERENCES chicks(id) ON DELETE CASCADE
);

-- Feeds table
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

-- Slaughtered table
CREATE TABLE IF NOT EXISTS slaughtered (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    date DATE NOT NULL,
    quantity INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES chicks(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_chicks_arrival_date ON chicks(arrival_date);
CREATE INDEX idx_mortality_date ON mortality_logs(date);
CREATE INDEX idx_feeds_expiry ON feeds(expiry_date);
CREATE INDEX idx_slaughtered_date ON slaughtered(date);

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (username, email, password_hash, role) 
VALUES ('admin', 'admin@bmk.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
