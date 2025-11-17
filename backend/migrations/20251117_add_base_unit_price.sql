-- Migration: add base_unit_price column to products
-- Run once on existing databases where column is absent.
-- Safe for MySQL 8.0+ (IF NOT EXISTS supported). For MariaDB <10.5, remove IF NOT EXISTS and check manually.
-- Generic ANSI-ish syntax (remove IF NOT EXISTS for widest compatibility)
ALTER TABLE products
  ADD base_unit_price DECIMAL(10,2) NULL;
