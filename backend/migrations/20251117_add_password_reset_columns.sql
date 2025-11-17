-- Migration: Add password reset columns to users table (MySQL/MariaDB)
-- Safe re-runnable form using IF NOT EXISTS

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `reset_token_hash` VARCHAR(64) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `reset_token_expires` DATETIME NULL;
