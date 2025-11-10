-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 19, 2025 at 10:50 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `bmk`
--

-- --------------------------------------------------------

--
-- Table structure for table `chicks`
--

CREATE TABLE `chicks` (
  `id` int(11) NOT NULL,
  `batch_name` varchar(50) DEFAULT NULL,
  `breed` varchar(50) DEFAULT NULL,
  `arrival_date` date DEFAULT NULL,
  `supplier` varchar(100) DEFAULT NULL,
  `initial_count` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chicks`
--

INSERT INTO `chicks` (`id`, `batch_name`, `breed`, `arrival_date`, `supplier`, `initial_count`) VALUES
(1, 'Batch A', 'Broiler', '2024-07-01', 'Supplier X', 1000),
(2, 'Batch B', 'Layer', '2024-07-10', 'Supplier Y', 800),
(3, '30 August', 'Starter', '2025-08-30', 'Ali', 1000),
(4, 'Isinya No. 002', 'Broiler', '2025-10-16', 'Isinya', 1000);

-- --------------------------------------------------------

--
-- Table structure for table `deliveries`
--

CREATE TABLE `deliveries` (
  `id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `delivery_date` date NOT NULL,
  `recipient_name` varchar(255) NOT NULL,
  `address` varchar(500) DEFAULT NULL,
  `quantity_delivered` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `delivered_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `feeds`
--

CREATE TABLE `feeds` (
  `id` int(11) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `quantity_kg` decimal(10,2) DEFAULT NULL,
  `supplier` varchar(100) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `feeds`
--

INSERT INTO `feeds` (`id`, `type`, `quantity_kg`, `supplier`, `purchase_date`, `expiry_date`) VALUES
(1, 'Starter', 440.00, 'FeedCo', '2024-07-01', '2024-08-01'),
(2, 'Grower', 700.00, 'FeedCo', '2024-07-15', '2024-09-01'),
(3, 'finisher', 480.00, 'Isinya Feeds', '2025-08-30', '2026-08-30'),
(4, 'layer', 800.00, 'Isinya Feeds', '2025-10-15', '2026-10-15');

-- --------------------------------------------------------

--
-- Table structure for table `feed_usage`
--

CREATE TABLE `feed_usage` (
  `id` int(11) NOT NULL,
  `feed_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `amount_used` decimal(10,2) NOT NULL,
  `used_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `feed_usage`
--

INSERT INTO `feed_usage` (`id`, `feed_id`, `user_id`, `amount_used`, `used_at`) VALUES
(1, 1, 3, 20.00, '2025-10-16 08:33:22'),
(2, 3, 3, 20.00, '2025-10-16 08:33:44'),
(3, 4, 3, 200.00, '2025-10-16 08:34:02'),
(4, 1, 3, 20.00, '2025-10-16 10:38:27');

-- --------------------------------------------------------

--
-- Table structure for table `mortality_logs`
--

CREATE TABLE `mortality_logs` (
  `id` int(11) NOT NULL,
  `chick_batch_id` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `number_dead` int(11) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `mortality_logs`
--

INSERT INTO `mortality_logs` (`id`, `chick_batch_id`, `date`, `number_dead`, `reason`) VALUES
(1, 1, '2024-07-07', 10, 'Heat stress'),
(2, 2, '2024-07-15', 5, 'Infection');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `order_date` date NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `product_type` varchar(100) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `slaughtered_id` int(11) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `packaged_quantity` int(11) DEFAULT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `slaughtered_id`, `type`, `packaged_quantity`, `batch_id`, `expiry_date`, `weight`, `created_at`) VALUES
(8, NULL, 'whole chicken', 1000, 3, NULL, NULL, '2025-10-19 20:49:42'),
(9, NULL, 'whole chicken', 100, 2, NULL, NULL, '2025-10-19 20:49:42'),
(10, NULL, 'chicken mince', 50, 2, NULL, NULL, '2025-10-19 20:49:42'),
(11, NULL, 'chicken wings', 50, 2, NULL, NULL, '2025-10-19 20:49:42');

-- --------------------------------------------------------

--
-- Table structure for table `product_types`
--

CREATE TABLE `product_types` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_types`
--

INSERT INTO `product_types` (`id`, `name`, `price`, `created_at`) VALUES
(1, 'whole chicken', 370.00, '2025-10-16 08:40:02'),
(2, 'chicken steak', 700.00, '2025-10-16 08:40:22'),
(3, 'chicken mince', 550.00, '2025-10-16 08:40:42'),
(4, 'chicken wings', 450.00, '2025-10-16 08:41:11'),
(5, 'chicken thigs/ legs', 500.00, '2025-10-19 19:51:05');

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `customer` varchar(100) DEFAULT NULL,
  `quantity_sold` int(11) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `slaughtered`
--

CREATE TABLE `slaughtered` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `avg_weight` decimal(10,2) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `slaughtered`
--

INSERT INTO `slaughtered` (`id`, `batch_id`, `date`, `quantity`, `avg_weight`, `notes`) VALUES
(1, 1, '2024-07-30', 900, 2.10, NULL),
(2, 2, '2024-08-05', 580, 1.80, NULL),
(3, 3, '2025-10-19', 0, 1.50, '');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('user','admin') DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `created_at`, `updated_at`) VALUES
(1, 'Admin User', 'admin@example.com', '$2b$10$zVzuPhuDa0lO0BjUxProvOfT7gKkY6mD3MGYb5b9Jh9Qpoml8MYzO', 'admin', '2025-08-07 06:43:40', '2025-08-07 06:43:40'),
(2, 'Regular User', 'user@example.com', '$2b$10$cyn/pImMm1ZGThFhaQHpHOYr/FfRYZiE6rj4qkqdmh5s5Nxwvp2DG', 'user', '2025-08-07 06:43:40', '2025-08-07 06:43:40'),
(3, 'Admin User', 'admin@bmk.com', '$2a$10$acGZ1M3bRlpE02SowQfpxuzHlQukQVjcpVgBamGD0GBRmc3vBM9JC', 'admin', '2025-08-11 13:00:36', '2025-08-11 13:00:36'),
(4, 'Test User', 'user@bmk.com', '$2a$10$2PfGz7nzPmlXmBCZ6isfwelyHy8q7P9vE8CD9AoB7m7tkztxm3oWO', 'user', '2025-08-11 13:00:36', '2025-08-11 13:00:36');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `chicks`
--
ALTER TABLE `chicks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `deliveries`
--
ALTER TABLE `deliveries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_deliveries_order` (`order_id`),
  ADD KEY `fk_deliveries_user` (`delivered_by`),
  ADD KEY `idx_deliveries_date` (`delivery_date`);

--
-- Indexes for table `feeds`
--
ALTER TABLE `feeds`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `feed_usage`
--
ALTER TABLE `feed_usage`
  ADD PRIMARY KEY (`id`),
  ADD KEY `feed_id` (`feed_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `mortality_logs`
--
ALTER TABLE `mortality_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `chick_batch_id` (`chick_batch_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_orders_product` (`product_id`),
  ADD KEY `fk_orders_user` (`created_by`),
  ADD KEY `idx_orders_date` (`order_date`),
  ADD KEY `idx_orders_status` (`status`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `slaughtered_id` (`slaughtered_id`),
  ADD KEY `idx_products_batch` (`batch_id`);

--
-- Indexes for table `product_types`
--
ALTER TABLE `product_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_product_types_name` (`name`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `slaughtered`
--
ALTER TABLE `slaughtered`
  ADD PRIMARY KEY (`id`),
  ADD KEY `batch_id` (`batch_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `chicks`
--
ALTER TABLE `chicks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `deliveries`
--
ALTER TABLE `deliveries`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `feeds`
--
ALTER TABLE `feeds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `feed_usage`
--
ALTER TABLE `feed_usage`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `mortality_logs`
--
ALTER TABLE `mortality_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `product_types`
--
ALTER TABLE `product_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `sales`
--
ALTER TABLE `sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `slaughtered`
--
ALTER TABLE `slaughtered`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `deliveries`
--
ALTER TABLE `deliveries`
  ADD CONSTRAINT `fk_deliveries_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_deliveries_user` FOREIGN KEY (`delivered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `feed_usage`
--
ALTER TABLE `feed_usage`
  ADD CONSTRAINT `feed_usage_ibfk_1` FOREIGN KEY (`feed_id`) REFERENCES `feeds` (`id`),
  ADD CONSTRAINT `feed_usage_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `mortality_logs`
--
ALTER TABLE `mortality_logs`
  ADD CONSTRAINT `mortality_logs_ibfk_1` FOREIGN KEY (`chick_batch_id`) REFERENCES `chicks` (`id`);

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_orders_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_batch` FOREIGN KEY (`batch_id`) REFERENCES `chicks` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`slaughtered_id`) REFERENCES `slaughtered` (`id`);

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `slaughtered`
--
ALTER TABLE `slaughtered`
  ADD CONSTRAINT `slaughtered_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `chicks` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
