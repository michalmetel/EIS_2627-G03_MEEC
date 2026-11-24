-- ====================================================================================================
-- CMS – Courier Management System | physical schema 
-- Team G03 – Sprint 2
--
-- HOW TO RUN (XAMPP): phpMyAdmin -> Import -> choose this file -> Go.
-- ====================================================================================================

CREATE DATABASE IF NOT EXISTS cms
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE cms;

-- ----------------------------------------------------------------------------------------------------
-- USER
-- ----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `USER` (
  user_id        INT          NOT NULL AUTO_INCREMENT,
  username       VARCHAR(100) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,          
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

-- ----------------------------------------------------------------------------------------------------
-- PRICING_SETTINGS
-- ----------------------------------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------------------------------
-- VEHICLE_TYPE
-- ----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS VEHICLE_TYPE (
  vehicle_type_id INT          NOT NULL AUTO_INCREMENT,
  type_name       ENUM('Bike','Moto','Van','Truck') NOT NULL,
  max_weight_kg   DECIMAL(10,2) NOT NULL,
  max_vol_m3      DECIMAL(10,3) NOT NULL,
  PRIMARY KEY (vehicle_type_id),
  UNIQUE KEY uq_vehicle_type_name (type_name),
  CONSTRAINT chk_vtype_positive CHECK (max_weight_kg > 0 AND max_vol_m3 > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------------------------------
-- VEHICLE
-- ----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS VEHICLE (
  vehicle_id             INT           NOT NULL AUTO_INCREMENT,
  courier_id             INT           NOT NULL,
  vehicle_type_id        INT           NOT NULL,
  license_plate          VARCHAR(15)   NOT NULL,
  model                  VARCHAR(100)  NOT NULL,
  max_weight_kg          DECIMAL(10,2) NOT NULL,
  max_vol_m3             DECIMAL(10,3) NOT NULL,
  insurance_expiry_date  DATE          NULL,
  inspection_expiry_date DATE          NULL,
  insurance_expiry_doc   VARCHAR(255)  NULL,
  inspection_expiry_doc  VARCHAR(255)  NULL,
  approval_status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by            INT           NULL,
  approved_at            DATETIME      NULL,
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vehicle_id),
  UNIQUE KEY uq_vehicle_plate (license_plate),
  KEY idx_vehicle_courier (courier_id),
  KEY idx_vehicle_status (approval_status),
  CONSTRAINT fk_vehicle_courier FOREIGN KEY (courier_id)
    REFERENCES `USER` (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_vehicle_type FOREIGN KEY (vehicle_type_id)
    REFERENCES VEHICLE_TYPE (vehicle_type_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_vehicle_approved_by FOREIGN KEY (approved_by)
    REFERENCES `USER` (user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_vehicle_positive CHECK (max_weight_kg > 0 AND max_vol_m3 > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- COURIER_DOCUMENT
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS COURIER_DOCUMENT (
  document_id  INT          NOT NULL AUTO_INCREMENT,
  user_id      INT          NOT NULL,
  doc_type     ENUM('id_card','criminal_record','driving_licence') NOT NULL,
  file_path    VARCHAR(255) NOT NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  uploaded_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by  INT          NULL,
  reviewed_at  DATETIME     NULL,
  PRIMARY KEY (document_id),
  KEY idx_cdoc_user (user_id),
  CONSTRAINT fk_cdoc_user FOREIGN KEY (user_id)
    REFERENCES `USER` (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cdoc_reviewed_by FOREIGN KEY (reviewed_by)
    REFERENCES `USER` (user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- PRODUCT
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PRODUCT (
  product_id   INT           NOT NULL AUTO_INCREMENT,
  client_id    INT           NOT NULL,
  description  VARCHAR(255)  NOT NULL,
  category     VARCHAR(50)   NULL,
  weight_kg    DECIMAL(10,2) NOT NULL,
  volume_m3    DECIMAL(10,4) NOT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  KEY idx_product_client (client_id),
  CONSTRAINT fk_product_client FOREIGN KEY (client_id)
    REFERENCES `USER` (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_product_positive CHECK (weight_kg > 0 AND volume_m3 > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- `ORDER`  
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ORDER` (
  order_id         INT           NOT NULL AUTO_INCREMENT,
  client_id        INT           NOT NULL,
  origin_lat       DECIMAL(9,6)  NOT NULL,
  origin_long      DECIMAL(9,6)  NOT NULL,
  dest_lat         DECIMAL(9,6)  NOT NULL,
  dest_long        DECIMAL(9,6)  NOT NULL,
  status           ENUM('pending_payment','pending','initiated','in_progress','completed','cancelled','rto')
                   NOT NULL DEFAULT 'pending_payment',
  attempt          INT           NOT NULL DEFAULT 1,
  distance_km      DECIMAL(8,2)  NOT NULL,
  price            DECIMAL(10,2) NOT NULL,
  actual_weight_kg DECIMAL(10,2) NULL,
  rto_reason       VARCHAR(255)  NULL,
  rto_at           DATETIME      NULL,
  delivery_code    CHAR(6)       NULL,
  code_file_path   VARCHAR(255)  NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_order_delivery_code (delivery_code),
  KEY idx_order_client (client_id),
  KEY idx_order_status (status),
  KEY idx_order_created (created_at),
  CONSTRAINT fk_order_client FOREIGN KEY (client_id)
    REFERENCES `USER` (user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_order_coords CHECK (
        origin_lat BETWEEN -90 AND 90 AND dest_lat BETWEEN -90 AND 90
    AND origin_long BETWEEN -180 AND 180 AND dest_long BETWEEN -180 AND 180),
  CONSTRAINT chk_order_amounts CHECK (distance_km >= 0 AND price >= 0 AND attempt >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- ORDER_ITEM
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ORDER_ITEM (
  order_id    INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id),
  KEY idx_item_product (product_id),
  CONSTRAINT fk_item_order FOREIGN KEY (order_id)
    REFERENCES `ORDER` (order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id)
    REFERENCES PRODUCT (product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_item_quantity CHECK (quantity >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- ROUTE
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ROUTE (
  route_id     INT      NOT NULL AUTO_INCREMENT,
  courier_id   INT      NOT NULL,
  vehicle_id   INT      NOT NULL,
  status       ENUM('initiated','in_progress','completed','cancelled') NOT NULL DEFAULT 'initiated',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at   DATETIME NULL,
  finished_at  DATETIME NULL,
  PRIMARY KEY (route_id),
  KEY idx_route_courier_status (courier_id, status),
  KEY idx_route_vehicle (vehicle_id),
  KEY idx_route_created (created_at),
  CONSTRAINT fk_route_courier FOREIGN KEY (courier_id)
    REFERENCES `USER` (user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_route_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES VEHICLE (vehicle_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- ROUTE_ORDER
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ROUTE_ORDER (
  route_id      INT      NOT NULL,
  order_id      INT      NOT NULL,
  stop_sequence INT      NOT NULL DEFAULT 1,
  assigned_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  picked_up_at  DATETIME NULL,
  delivered_at  DATETIME NULL,
  PRIMARY KEY (route_id, order_id),
  KEY idx_route_order_order (order_id),
  CONSTRAINT fk_ro_route FOREIGN KEY (route_id)
    REFERENCES ROUTE (route_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ro_order FOREIGN KEY (order_id)
    REFERENCES `ORDER` (order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_ro_sequence CHECK (stop_sequence >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- PROOF_OF_DELIVERY
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PROOF_OF_DELIVERY (
  pod_id           INT          NOT NULL AUTO_INCREMENT,
  route_id         INT          NOT NULL,
  order_id         INT          NOT NULL,
  pod_type         ENUM('signature','photo') NOT NULL,
  received_by_name VARCHAR(100) NULL,
  file_path        VARCHAR(255) NOT NULL,
  submitted_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pod_id),
  UNIQUE KEY uq_pod_route_order (route_id, order_id),
  CONSTRAINT fk_pod_route_order FOREIGN KEY (route_id, order_id)
    REFERENCES ROUTE_ORDER (route_id, order_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- TRACKING_POINT
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TRACKING_POINT (
  tracking_id  INT          NOT NULL AUTO_INCREMENT,
  route_id     INT          NOT NULL,
  latitude     DECIMAL(9,6) NOT NULL,
  longitude    DECIMAL(9,6) NOT NULL,
  recorded_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tracking_id),
  KEY idx_tracking_route (route_id, recorded_at),
  CONSTRAINT fk_tracking_route FOREIGN KEY (route_id)
    REFERENCES ROUTE (route_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_tracking_coords CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- NOTIFICATION
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS NOTIFICATION (
  notification_id INT          NOT NULL AUTO_INCREMENT,
  recipient_id    INT          NOT NULL,
  vehicle_id      INT          NULL,
  `type`          ENUM('doc_uploaded','doc_expired','vehicle_issue','approval_request') NOT NULL,
  message         VARCHAR(255) NOT NULL,
  is_read         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_by     INT          NULL,
  resolved_at     DATETIME     NULL,
  PRIMARY KEY (notification_id),
  KEY idx_notif_recipient (recipient_id, is_read),
  KEY idx_notif_vehicle (vehicle_id),
  CONSTRAINT fk_notif_recipient FOREIGN KEY (recipient_id)
    REFERENCES `USER` (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notif_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES VEHICLE (vehicle_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notif_resolved_by FOREIGN KEY (resolved_by)
    REFERENCES `USER` (user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- ORDER_STATUS_HISTORY
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ORDER_STATUS_HISTORY (
  history_id  INT         NOT NULL AUTO_INCREMENT,
  order_id    INT         NOT NULL,
  changed_by  INT         NULL,
  old_status  VARCHAR(20) NULL,
  new_status  VARCHAR(20) NOT NULL,
  changed_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id),
  KEY idx_history_order (order_id, changed_at),
  CONSTRAINT fk_history_order FOREIGN KEY (order_id)
    REFERENCES `ORDER` (order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by)
    REFERENCES `USER` (user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- PAYMENT
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PAYMENT (
  payment_id   INT           NOT NULL AUTO_INCREMENT,
  order_id     INT           NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  `type`       ENUM('order','rto_fee') NOT NULL DEFAULT 'order',
  gateway_ref  VARCHAR(100)  NULL,
  status       ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at      DATETIME      NULL,
  PRIMARY KEY (payment_id),
  KEY idx_payment_order (order_id),
  KEY idx_payment_paid (status, paid_at),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id)
    REFERENCES `ORDER` (order_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_payment_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------------------------------
-- DISPATCH_OFFER
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS DISPATCH_OFFER (
  offer_id    INT      NOT NULL AUTO_INCREMENT,
  order_id    INT      NOT NULL,
  courier_id  INT      NOT NULL,
  offered_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  response    ENUM('accepted','declined','expired') NULL,
  PRIMARY KEY (offer_id),
  KEY idx_offer_order (order_id),
  KEY idx_offer_courier (courier_id, response, expires_at),
  CONSTRAINT fk_offer_order FOREIGN KEY (order_id)
    REFERENCES `ORDER` (order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_offer_courier FOREIGN KEY (courier_id)
    REFERENCES `USER` (user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================================================
-- SAMPLE DATA 
-- ====================================================================================================

INSERT IGNORE INTO PRICING_SETTINGS (pricing_id, fee_base, rate_km, rate_kg)
VALUES (1, 2.50, 0.40, 0.30);

INSERT IGNORE INTO `USER`
  (username, password_hash, email, name, phone, nif, role, account_status)
VALUES
  ('client@cms.pt',   '$2y$10$PyRpRHIWBXxyjKvH.rQRVO.DJskpBKdgipXfK.sQkearM6YoSm0j.', 'client@cms.pt',   'Ana Ferreira',  '+351912345601', '123456789', 'client',  'approved'),
  ('courier@cms.pt',  '$2y$10$E38n4970pnrYAGQ.2O1R8uXKelMF0uWvUQwN8V9LZJHFBggI7TzNq', 'courier@cms.pt',  'Ricardo Silva', '+351912345602', '234567890', 'courier', 'approved'),
  ('staff@cms.pt',    '$2y$10$4wadFNLgQvbV9iFuPhuUrOuauzbWaU25tPELIfJ.2QlIATEM.rpUq', 'staff@cms.pt',    'Miguel Costa',  '+351912345603', '345678901', 'staff',   'approved'),
  ('admin@cms.pt',    '$2y$10$5Kz2lRRiLK4O.O9o.BTL7.5/axEPlK8OCZLdAH/I4EH66.vWKNyly', 'admin@cms.pt',    'Beatriz Lopes', '+351912345604', '456789012', 'admin',   'approved'),
  -- accounts waiting for approval
  ('courier2@cms.pt', '$2y$10$E38n4970pnrYAGQ.2O1R8uXKelMF0uWvUQwN8V9LZJHFBggI7TzNq', 'courier2@cms.pt', 'Tiago Almeida', '+351912345605', '567890123', 'courier', 'pending'),
  ('staff2@cms.pt',   '$2y$10$4wadFNLgQvbV9iFuPhuUrOuauzbWaU25tPELIfJ.2QlIATEM.rpUq', 'staff2@cms.pt',   'Sofia Mendes',  '+351912345606', '678901234', 'staff',   'pending'),
  -- second approved courier
  ('courier3@cms.pt', '$2y$10$E38n4970pnrYAGQ.2O1R8uXKelMF0uWvUQwN8V9LZJHFBggI7TzNq', 'courier3@cms.pt', 'Joana Pinto',   '+351912345607', '789012345', 'courier', 'approved');

SET @client   = (SELECT user_id FROM `USER` WHERE username = 'client@cms.pt');
SET @courier  = (SELECT user_id FROM `USER` WHERE username = 'courier@cms.pt');
SET @staff    = (SELECT user_id FROM `USER` WHERE username = 'staff@cms.pt');
SET @admin    = (SELECT user_id FROM `USER` WHERE username = 'admin@cms.pt');
SET @courier2 = (SELECT user_id FROM `USER` WHERE username = 'courier2@cms.pt');
SET @courier3 = (SELECT user_id FROM `USER` WHERE username = 'courier3@cms.pt');

UPDATE `USER` SET approved_by = @staff, approved_at = NOW()
 WHERE username IN ('courier@cms.pt', 'courier3@cms.pt') AND approved_by IS NULL;
UPDATE `USER` SET approved_by = @admin, approved_at = NOW()
 WHERE username = 'staff@cms.pt' AND approved_by IS NULL;

-- ---- Vehicle types ----
INSERT IGNORE INTO VEHICLE_TYPE (vehicle_type_id, type_name, max_weight_kg, max_vol_m3) VALUES
  (1, 'Bike',     10.00,  0.050),
  (2, 'Moto',     30.00,  0.200),
  (3, 'Van',    1000.00,  8.000),
  (4, 'Truck',  5000.00, 40.000);

-- ---- Vehicles ----
--  1 Bike  approved, documents valid
--  2 Moto  approved, documents valid
--  3 Van   approved, insurance expires in 20 days (yellow alert)
--  4 Truck pending, inspection already expired (red alert)
INSERT IGNORE INTO VEHICLE
  (vehicle_id, courier_id, vehicle_type_id, license_plate, model, max_weight_kg, max_vol_m3,
   insurance_expiry_date, inspection_expiry_date, insurance_expiry_doc, inspection_expiry_doc,
   approval_status, approved_by, approved_at)
VALUES
  (1, @courier,  1, '11-AA-11', 'Gazelle Bike',     10.00,    0.050, CURDATE() + INTERVAL 300 DAY, CURDATE() + INTERVAL 300 DAY, 'uploads/vehicles/1/insurance.pdf', 'uploads/vehicles/1/inspection.pdf', 'approved', @staff, NOW()),
  (2, @courier,  2, '22-BB-22', 'Honda PCX 125',    30.00,    0.200, CURDATE() + INTERVAL 200 DAY, CURDATE() + INTERVAL 150 DAY, 'uploads/vehicles/2/insurance.pdf', 'uploads/vehicles/2/inspection.pdf', 'approved', @staff, NOW()),
  (3, @courier3, 3, '33-CC-33', 'Renault Kangoo', 1000.00,    8.000, CURDATE() + INTERVAL 20 DAY,  CURDATE() + INTERVAL 250 DAY, 'uploads/vehicles/3/insurance.pdf', 'uploads/vehicles/3/inspection.pdf', 'approved', @staff, NOW()),
  (4, @courier3, 4, '44-DD-44', 'Mercedes Atego', 5000.00,   40.000, CURDATE() + INTERVAL 100 DAY, CURDATE() - INTERVAL 10 DAY,  'uploads/vehicles/4/insurance.pdf', 'uploads/vehicles/4/inspection.pdf', 'pending',  NULL,   NULL);

-- ---- Courier documents ----
INSERT IGNORE INTO COURIER_DOCUMENT
  (document_id, user_id, doc_type, file_path, status, reviewed_by, reviewed_at)
VALUES
  (1, @courier,  'id_card',         CONCAT('uploads/couriers/', @courier,  '/id_card.pdf'),         'approved', @staff, NOW()),
  (2, @courier,  'criminal_record', CONCAT('uploads/couriers/', @courier,  '/criminal_record.pdf'), 'approved', @staff, NOW()),
  (3, @courier3, 'id_card',         CONCAT('uploads/couriers/', @courier3, '/id_card.pdf'),         'approved', @staff, NOW()),
  (4, @courier3, 'criminal_record', CONCAT('uploads/couriers/', @courier3, '/criminal_record.pdf'), 'approved', @staff, NOW()),
  (5, @courier2, 'id_card',         CONCAT('uploads/couriers/', @courier2, '/id_card.pdf'),         'pending',  NULL,   NULL),
  (6, @courier2, 'criminal_record', CONCAT('uploads/couriers/', @courier2, '/criminal_record.pdf'), 'pending',  NULL,   NULL);

-- ---- Products of the sample client ----
INSERT IGNORE INTO PRODUCT (product_id, client_id, description, category, weight_kg, volume_m3) VALUES
  (1, @client, 'Documents envelope', 'Documents',   0.50, 0.0020),
  (2, @client, 'Laptop',             'Electronics', 3.00, 0.0200),
  (3, @client, 'Box of books',       'Books',       8.00, 0.0300),
  (4, @client, 'Small TV',           'Electronics', 12.00, 0.1200),
  (5, @client, 'Flower bouquet',     'Fragile',     1.20, 0.0500),
  (6, @client, 'Office chair',       'Furniture',   9.00, 0.2500);

-- ---- Orders ----
-- Places (Porto area): FEUP 41.1780,-8.5980 | Trindade 41.1521,-8.6097 |
-- Casa da Musica 41.1588,-8.6307 | Gaia 41.1239,-8.6118 | Matosinhos 41.1821,-8.6891 | Maia 41.2357,-8.6199
-- price = 2.50 + distance_km * 0.40 + MAX(weight, volume*200) * 0.30
INSERT IGNORE INTO `ORDER`
  (order_id, client_id, origin_lat, origin_long, dest_lat, dest_long, status, attempt,
   distance_km, price, actual_weight_kg, rto_reason, rto_at, delivery_code, code_file_path, created_at)
VALUES
  -- 1 pending_payment: the spec example (3 kg, 0.02 m3, 15 km = 9.70)
  (1, @client, 41.178000, -8.598000, 41.123900, -8.611800, 'pending_payment', 1, 15.00,  9.70, NULL, NULL, NULL, NULL,     NULL,                              NOW() - INTERVAL 1 HOUR),
  -- 2 pending: paid, waiting for a courier
  (2, @client, 41.152100, -8.609700, 41.235700, -8.619900, 'pending',         1,  6.20,  5.28, NULL, NULL, NULL, NULL,     NULL,                              NOW() - INTERVAL 20 MINUTE),
  -- 3 initiated: accepted by a courier (stop 2 of route 1)
  (3, @client, 41.158800, -8.630700, 41.178000, -8.598000, 'initiated',        1,  9.80,  8.82, NULL, NULL, NULL, '482915', 'uploads/codes/order_3_code.txt',  NOW() - INTERVAL 3 HOUR),
  -- 4 in_progress: being delivered (stop 1 of route 1)
  (4, @client, 41.178000, -8.598000, 41.152100, -8.609700, 'in_progress',     1,  4.10,  7.14, 1.20, NULL, NULL, '730164', 'uploads/codes/order_4_code.txt',  NOW() - INTERVAL 4 HOUR),
  -- 5 completed today
  (5, @client, 41.182100, -8.689100, 41.178000, -8.598000, 'completed',       1, 12.30, 14.62, 12.00, NULL, NULL, '915208', 'uploads/codes/order_5_code.txt',  NOW() - INTERVAL 6 HOUR),
  -- 6 completed last month
  (6, @client, 41.152100, -8.609700, 41.123900, -8.611800, 'completed',       1,  8.00,  6.90, 3.00, NULL, NULL, '264073', 'uploads/codes/order_6_code.txt',  NOW() - INTERVAL 35 DAY),
  -- 7 completed two months ago
  (7, @client, 41.235700, -8.619900, 41.158800, -8.630700, 'completed',       1, 21.40, 15.86, 16.00, NULL, NULL, '618342', 'uploads/codes/order_7_code.txt',  NOW() - INTERVAL 65 DAY),
  -- 8 cancelled before payment (payment failed)
  (8, @client, 41.178000, -8.598000, 41.182100, -8.689100, 'cancelled',       1,  3.30,  3.97, NULL, NULL, NULL, NULL,     NULL,                              NOW() - INTERVAL 2 DAY),
  -- 9 rto: declared 9 kg (50 kg chargeable by volume) but the real weight is 62 kg.
  --    price recalculated = 25.50 ; the client owes 3.60 (weight) + 4.40 (return km) = 8.00
  (9, @client, 41.178000, -8.598000, 41.123900, -8.611800, 'rto',             1, 11.00, 25.50, 62.00, 'Real weight (62.00 kg) is higher than declared (9.00 kg)', NOW() - INTERVAL 1 HOUR, '507716', 'uploads/codes/order_9_code.txt', NOW() - INTERVAL 5 HOUR);

INSERT IGNORE INTO ORDER_ITEM (order_id, product_id, quantity) VALUES
  (1, 2, 1),
  (2, 1, 2),
  (3, 3, 1),
  (4, 5, 1),
  (5, 4, 1),
  (6, 2, 1),
  (7, 3, 2),
  (8, 1, 1),
  (9, 6, 1);

-- ---- Routes ----
--  1 courier  + Moto : in progress, pooled route with orders 4 and 3 (stops 1 and 2)
--  2 courier  + Moto : completed today (order 5)
--  3 courier  + Moto : completed last month (order 6)
--  4 courier  + Moto : completed two months ago (order 7)
--  5 courier3 + Van  : order 9, halted because of the RTO
INSERT IGNORE INTO ROUTE (route_id, courier_id, vehicle_id, status, created_at, started_at, finished_at) VALUES
  (1, @courier,  2, 'in_progress', NOW() - INTERVAL 3 HOUR,  NOW() - INTERVAL 150 MINUTE, NULL),
  (2, @courier,  2, 'completed',   NOW() - INTERVAL 6 HOUR,  NOW() - INTERVAL 350 MINUTE, NOW() - INTERVAL 5 HOUR),
  (3, @courier,  2, 'completed',   NOW() - INTERVAL 35 DAY,  NOW() - INTERVAL 35 DAY,     NOW() - INTERVAL 35 DAY + INTERVAL 45 MINUTE),
  (4, @courier,  2, 'completed',   NOW() - INTERVAL 65 DAY,  NOW() - INTERVAL 65 DAY,     NOW() - INTERVAL 65 DAY + INTERVAL 70 MINUTE),
  (5, @courier3, 3, 'in_progress', NOW() - INTERVAL 5 HOUR,  NOW() - INTERVAL 290 MINUTE, NULL);

INSERT IGNORE INTO ROUTE_ORDER (route_id, order_id, stop_sequence, assigned_at, picked_up_at, delivered_at) VALUES
  (1, 4, 1, NOW() - INTERVAL 3 HOUR,  NOW() - INTERVAL 150 MINUTE, NULL),
  (1, 3, 2, NOW() - INTERVAL 3 HOUR,  NULL,                        NULL),
  (2, 5, 1, NOW() - INTERVAL 6 HOUR,  NOW() - INTERVAL 350 MINUTE, NOW() - INTERVAL 5 HOUR),
  (3, 6, 1, NOW() - INTERVAL 35 DAY,  NOW() - INTERVAL 35 DAY,     NOW() - INTERVAL 35 DAY + INTERVAL 45 MINUTE),
  (4, 7, 1, NOW() - INTERVAL 65 DAY,  NOW() - INTERVAL 65 DAY,     NOW() - INTERVAL 65 DAY + INTERVAL 70 MINUTE),
  (5, 9, 1, NOW() - INTERVAL 5 HOUR,  NOW() - INTERVAL 290 MINUTE, NULL);

INSERT IGNORE INTO PROOF_OF_DELIVERY (pod_id, route_id, order_id, pod_type, received_by_name, file_path, submitted_at) VALUES
  (1, 2, 5, 'signature', 'Ana Ferreira', 'uploads/pod/order_5_signature.png', NOW() - INTERVAL 5 HOUR),
  (2, 3, 6, 'photo',     'Carlos Neves', 'uploads/pod/order_6_photo.jpg',     NOW() - INTERVAL 35 DAY + INTERVAL 45 MINUTE),
  (3, 4, 7, 'signature', 'Rita Gomes',   'uploads/pod/order_7_signature.png', NOW() - INTERVAL 65 DAY + INTERVAL 70 MINUTE);

-- GPS trail of the route in progress
INSERT IGNORE INTO TRACKING_POINT (tracking_id, route_id, latitude, longitude, recorded_at) VALUES
  (1, 1, 41.178000, -8.598000, NOW() - INTERVAL 150 MINUTE),
  (2, 1, 41.170500, -8.601200, NOW() - INTERVAL 140 MINUTE),
  (3, 1, 41.161000, -8.605500, NOW() - INTERVAL 130 MINUTE),
  (4, 1, 41.152100, -8.609700, NOW() - INTERVAL 120 MINUTE);

-- ---- Payments ----
INSERT IGNORE INTO PAYMENT (payment_id, order_id, amount, `type`, gateway_ref, status, created_at, paid_at) VALUES
  (1, 2, 5.28,  'order',   'MG-100002', 'success', NOW() - INTERVAL 20 MINUTE, NOW() - INTERVAL 19 MINUTE),
  (2, 3, 8.82,  'order',   'MG-100003', 'success', NOW() - INTERVAL 3 HOUR,    NOW() - INTERVAL 3 HOUR),
  (3, 4, 7.14,  'order',   'MG-100004', 'success', NOW() - INTERVAL 4 HOUR,    NOW() - INTERVAL 4 HOUR),
  (4, 5, 14.62, 'order',   'MG-100005', 'success', NOW() - INTERVAL 6 HOUR,    NOW() - INTERVAL 6 HOUR),
  (5, 6, 6.90,  'order',   'MG-100006', 'success', NOW() - INTERVAL 35 DAY,    NOW() - INTERVAL 35 DAY),
  (6, 7, 15.86, 'order',   'MG-100007', 'success', NOW() - INTERVAL 65 DAY,    NOW() - INTERVAL 65 DAY),
  (7, 8, 3.97,  'order',   'MG-100008', 'failed',  NOW() - INTERVAL 2 DAY,     NULL),
  (8, 9, 21.90, 'order',   'MG-100009', 'success', NOW() - INTERVAL 5 HOUR,    NOW() - INTERVAL 5 HOUR),
  -- the extra fee of order 9 (3.60 weight + 4.40 return distance), not paid yet
  (9, 9, 8.00,  'rto_fee', NULL,        'pending', NOW() - INTERVAL 1 HOUR,    NULL);

-- ---- Dispatch offers ----
INSERT IGNORE INTO DISPATCH_OFFER (offer_id, order_id, courier_id, offered_at, expires_at, response) VALUES
  (1, 2, @courier3, NOW() - INTERVAL 19 MINUTE, NOW() - INTERVAL 19 MINUTE + INTERVAL 60 SECOND, 'declined'),
  (2, 2, @courier,  NOW() - INTERVAL 18 MINUTE, NOW() - INTERVAL 18 MINUTE + INTERVAL 60 SECOND, 'expired'),
  (3, 3, @courier,  NOW() - INTERVAL 3 HOUR,    NOW() - INTERVAL 3 HOUR + INTERVAL 60 SECOND,    'accepted'),
  (4, 4, @courier,  NOW() - INTERVAL 4 HOUR,    NOW() - INTERVAL 4 HOUR + INTERVAL 60 SECOND,    'accepted'),
  (5, 9, @courier3, NOW() - INTERVAL 5 HOUR,    NOW() - INTERVAL 5 HOUR + INTERVAL 60 SECOND,    'accepted');

-- ---- Order status history ----
INSERT IGNORE INTO ORDER_STATUS_HISTORY (history_id, order_id, changed_by, old_status, new_status, changed_at) VALUES
  (1, 4, @courier, 'pending',     'initiated',   NOW() - INTERVAL 4 HOUR),
  (2, 4, @courier, 'initiated',   'in_progress', NOW() - INTERVAL 150 MINUTE),
  (3, 5, @courier, 'in_progress', 'completed',   NOW() - INTERVAL 5 HOUR),
  (4, 8, @client,  'pending_payment', 'cancelled', NOW() - INTERVAL 2 DAY),
  (5, 9, @courier3, 'in_progress', 'rto',        NOW() - INTERVAL 1 HOUR);

-- ---- Staff alerts ----
INSERT IGNORE INTO NOTIFICATION
  (notification_id, recipient_id, vehicle_id, `type`, message, is_read, created_at)
VALUES
  (1, @staff, 4,    'doc_expired',      'Inspection certificate of vehicle 44-DD-44 has expired.',            0, NOW() - INTERVAL 1 DAY),
  (2, @staff, 3,    'doc_expired',      'Insurance of vehicle 33-CC-33 expires in 20 days.',                  0, NOW() - INTERVAL 3 HOUR),
  (3, @staff, NULL, 'approval_request', 'New courier account waiting for approval: courier2@cms.pt.',        0, NOW() - INTERVAL 2 HOUR);
