-- =====================================================================
-- CMS – Courier Management System | physical schema 
-- Team G03 – Sprint 2
-- =====================================================================

CREATE DATABASE IF NOT EXISTS cms
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE cms;

-- ---------------------------------------------------------------------
-- USER: one table for the four roles (client, courier, staff, admin).
-- Column names follow the ER diagram and are used by UserRepository.php.
--   account_status: new couriers/staff/admins start as 'pending' and
--                   are approved by staff (couriers) or admin (staff, admin).
--   approved_by / approved_at: who approved the account and when
--                   (NULL while pending, for clients and for the seed admin).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `USER` (
  user_id        INT          NOT NULL AUTO_INCREMENT,
  username       VARCHAR(100) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,          -- bcrypt via password_hash(), never plain text
  email          VARCHAR(100) NOT NULL,
  name           VARCHAR(100) NOT NULL,
  phone          VARCHAR(20)  NULL,
  nif            CHAR(9)      NULL,
  role           ENUM('client','courier','staff','admin') NOT NULL,
  account_status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  approved_by    INT          NULL,
  approved_at    DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_username (username),
  UNIQUE KEY uq_user_email (email),
  KEY idx_user_role_status (role, account_status),
  CONSTRAINT fk_user_approved_by
    FOREIGN KEY (approved_by) REFERENCES `USER` (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- PRICING_SETTINGS: a single row (pricing_id = 1) the admin can edit.
--   Price = fee_base + distance_km * rate_km + chargeable_kg * rate_kg
-- Read by PricingRepository.php.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PRICING_SETTINGS (
  pricing_id  INT           NOT NULL,
  fee_base    DECIMAL(10,2) NOT NULL,
  rate_km     DECIMAL(10,2) NOT NULL,
  rate_kg     DECIMAL(10,2) NOT NULL,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (pricing_id),
  CONSTRAINT chk_pricing_single_row CHECK (pricing_id = 1),
  CONSTRAINT chk_pricing_positive CHECK (fee_base >= 0 AND rate_km >= 0 AND rate_kg >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- SAMPLE DATA  (INSERT IGNORE: rows that already exist are skipped)
-- =====================================================================

INSERT IGNORE INTO PRICING_SETTINGS (pricing_id, fee_base, rate_km, rate_kg)
VALUES (1, 2.50, 0.40, 0.30);

-- Test accounts. Password for ALL of them: password123
-- (bcrypt hashes; replace with the team's final hashes if they change)
-- The first four are the same accounts as in 00_core_temp.sql.
INSERT IGNORE INTO `USER`
  (username, password_hash, email, name, phone, nif, role, account_status)
VALUES
  ('client@cms.pt',   '$2y$10$PyRpRHIWBXxyjKvH.rQRVO.DJskpBKdgipXfK.sQkearM6YoSm0j.', 'client@cms.pt',   'Ana Ferreira',  '+351912345601', '123456789', 'client',  'approved'),
  ('courier@cms.pt',  '$2y$10$E38n4970pnrYAGQ.2O1R8uXKelMF0uWvUQwN8V9LZJHFBggI7TzNq', 'courier@cms.pt',  'Ricardo Silva', '+351912345602', '234567890', 'courier', 'approved'),
  ('staff@cms.pt',    '$2y$10$4wadFNLgQvbV9iFuPhuUrOuauzbWaU25tPELIfJ.2QlIATEM.rpUq', 'staff@cms.pt',    'Miguel Costa',  '+351912345603', '345678901', 'staff',   'approved'),
  ('admin@cms.pt',    '$2y$10$5Kz2lRRiLK4O.O9o.BTL7.5/axEPlK8OCZLdAH/I4EH66.vWKNyly', 'admin@cms.pt',    'Beatriz Lopes', '+351912345604', '456789012', 'admin',   'approved'),
  -- accounts waiting for approval (to demo the Staff and Admin approval tables)
  ('courier2@cms.pt', '$2y$10$E38n4970pnrYAGQ.2O1R8uXKelMF0uWvUQwN8V9LZJHFBggI7TzNq', 'courier2@cms.pt', 'Tiago Almeida', '+351912345605', '567890123', 'courier', 'pending'),
  ('staff2@cms.pt',   '$2y$10$4wadFNLgQvbV9iFuPhuUrOuauzbWaU25tPELIfJ.2QlIATEM.rpUq', 'staff2@cms.pt',   'Sofia Mendes',  '+351912345606', '678901234', 'staff',   'pending');

-- The approved courier and staff accounts were approved by the admin.
-- (Only fills in rows that have no approver yet, so it is safe to re-run.)
SET @admin_id = (SELECT user_id FROM `USER` WHERE username = 'admin@cms.pt');

UPDATE `USER`
   SET approved_by = @admin_id, approved_at = NOW()
 WHERE username IN ('courier@cms.pt', 'staff@cms.pt')
   AND approved_by IS NULL;
