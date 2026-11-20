-- TEMPORARY (Michał) – Hugo will merge this into cms.sql. Column names follow the ER diagram.
CREATE DATABASE IF NOT EXISTS cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cms;

CREATE TABLE IF NOT EXISTS `USER` (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(100) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  email          VARCHAR(100) NOT NULL UNIQUE,
  name           VARCHAR(100) NOT NULL,
  phone          VARCHAR(20),
  nif            CHAR(9),
  role           ENUM('client','courier','staff','admin') NOT NULL,
  account_status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  approved_by    INT NULL,
  approved_at    DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (approved_by) REFERENCES `USER`(user_id)
);

CREATE TABLE IF NOT EXISTS PRICING_SETTINGS (
  pricing_id  INT PRIMARY KEY,
  fee_base    DECIMAL(10,2) NOT NULL,
  rate_km     DECIMAL(10,2) NOT NULL,
  rate_kg     DECIMAL(10,2) NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO PRICING_SETTINGS (pricing_id, fee_base, rate_km, rate_kg) VALUES (1, 2.50, 0.40, 0.30);

-- test accounts, password for all: password123
INSERT INTO `USER` (username, password_hash, email, name, phone, nif, role, account_status) VALUES
('client@cms.pt',  '$2y$10$PyRpRHIWBXxyjKvH.rQRVO.DJskpBKdgipXfK.sQkearM6YoSm0j.', 'client@cms.pt',  'Ana Ferreira',  '+351912345601', '123456789', 'client',  'approved'),
('courier@cms.pt', '$2y$10$E38n4970pnrYAGQ.2O1R8uXKelMF0uWvUQwN8V9LZJHFBggI7TzNq', 'courier@cms.pt', 'Ricardo Silva', '+351912345602', '234567890', 'courier', 'approved'),
('staff@cms.pt',   '$2y$10$4wadFNLgQvbV9iFuPhuUrOuauzbWaU25tPELIfJ.2QlIATEM.rpUq', 'staff@cms.pt',   'Miguel Costa',  '+351912345603', '345678901', 'staff',   'approved'),
('admin@cms.pt',   '$2y$10$5Kz2lRRiLK4O.O9o.BTL7.5/axEPlK8OCZLdAH/I4EH66.vWKNyly', 'admin@cms.pt',   'Beatriz Lopes', '+351912345604', '456789012', 'admin',   'approved');
