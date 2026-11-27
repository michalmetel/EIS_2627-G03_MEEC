<?php
// DAL: SQL for WP3 (dispatch queue). Tables: DISPATCH_OFFER, ORDER, ROUTE, ROUTE_ORDER, VEHICLE.
class DispatchRepository
{
    // Offers nobody answered in time become 'expired'.
    public static function expireOverdueOffers(): void
    {
        Database::get()->exec(
            "UPDATE DISPATCH_OFFER SET response = 'expired'
              WHERE response IS NULL AND expires_at < NOW()"
        );
    }

    // Paid orders ('pending') that have no open offer right now, oldest first.
    public static function ordersWaitingForCourier(): array
    {
        $stmt = Database::get()->query(
            "SELECT o.order_id, o.origin_lat, o.origin_long
               FROM `ORDER` o
              WHERE o.status = 'pending'
                AND NOT EXISTS (SELECT 1 FROM DISPATCH_OFFER d
                                 WHERE d.order_id = o.order_id AND d.response IS NULL)
              ORDER BY o.created_at"
        );
        return $stmt->fetchAll();
    }

    // Total weight (kg) and volume (m3) of all the items of an order.
    public static function orderLoad(int $orderId): array
    {
        $stmt = Database::get()->prepare(
            'SELECT COALESCE(SUM(p.weight_kg * oi.quantity), 0) AS weight_kg,
                    COALESCE(SUM(p.volume_m3 * oi.quantity), 0) AS volume_m3
               FROM ORDER_ITEM oi
               JOIN PRODUCT p ON p.product_id = oi.product_id
              WHERE oi.order_id = ?'
        );
        $stmt->execute([$orderId]);
        return $stmt->fetch();
    }

    // Couriers who can receive an offer for this order:
    //  - approved account
    //  - at least one approved vehicle, documents valid, big enough for the load
    //  - no open offer at the moment (one offer at a time)
    //  - not tried for this order in the last $retryMinutes minutes
    public static function eligibleCouriers(int $orderId, float $weightKg, float $volumeM3, int $retryMinutes): array
    {
        $stmt = Database::get()->prepare(
            "SELECT u.user_id, u.name
               FROM `USER` u
              WHERE u.role = 'courier' AND u.account_status = 'approved'
                AND EXISTS (SELECT 1 FROM VEHICLE v
                             WHERE v.courier_id = u.user_id
                               AND v.approval_status = 'approved'
                               AND (v.insurance_expiry_date  IS NULL OR v.insurance_expiry_date  >= CURDATE())
                               AND (v.inspection_expiry_date IS NULL OR v.inspection_expiry_date >= CURDATE())
                               AND v.max_weight_kg >= ? AND v.max_vol_m3 >= ?)
                AND NOT EXISTS (SELECT 1 FROM DISPATCH_OFFER d
                                 WHERE d.courier_id = u.user_id AND d.response IS NULL)
                AND NOT EXISTS (SELECT 1 FROM DISPATCH_OFFER d
                                 WHERE d.courier_id = u.user_id AND d.order_id = ?
                                   AND d.offered_at > NOW() - INTERVAL ? MINUTE)"
        );
        $stmt->execute([$weightKg, $volumeM3, $orderId, $retryMinutes]);
        return $stmt->fetchAll();
    }

    // Courier location = drop-off point of the last delivery they completed (spec 4.3).
    // Returns null if the courier never delivered anything.
    public static function lastDropOff(int $courierId): ?array
    {
        $stmt = Database::get()->prepare(
            "SELECT o.dest_lat AS lat, o.dest_long AS lng
               FROM ROUTE r
               JOIN ROUTE_ORDER ro ON ro.route_id = r.route_id
               JOIN `ORDER` o      ON o.order_id  = ro.order_id
              WHERE r.courier_id = ? AND o.status = 'completed' AND ro.delivered_at IS NOT NULL
              ORDER BY ro.delivered_at DESC
              LIMIT 1"
        );
        $stmt->execute([$courierId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function createOffer(int $orderId, int $courierId, int $seconds): void
    {
        $stmt = Database::get()->prepare(
            'INSERT INTO DISPATCH_OFFER (order_id, courier_id, offered_at, expires_at)
             VALUES (?, ?, NOW(), NOW() + INTERVAL ? SECOND)'
        );
        $stmt->execute([$orderId, $courierId, $seconds]);
    }

    // The offer this courier has to answer now (with the order data), or null.
    // seconds_left is calculated by MySQL so the browser clock does not matter.
    public static function openOfferForCourier(int $courierId): ?array
    {
        $stmt = Database::get()->prepare(
            "SELECT d.offer_id, d.order_id, d.expires_at,
                    GREATEST(TIMESTAMPDIFF(SECOND, NOW(), d.expires_at), 0) AS seconds_left,
                    o.origin_lat, o.origin_long, o.dest_lat, o.dest_long, o.distance_km, o.price
               FROM DISPATCH_OFFER d
               JOIN `ORDER` o ON o.order_id = d.order_id
              WHERE d.courier_id = ? AND d.response IS NULL AND d.expires_at >= NOW()
              ORDER BY d.offered_at DESC
              LIMIT 1"
        );
        $stmt->execute([$courierId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findOffer(int $offerId): ?array
    {
        $stmt = Database::get()->prepare(
            'SELECT d.*, (d.expires_at >= NOW()) AS still_valid FROM DISPATCH_OFFER d WHERE d.offer_id = ?'
        );
        $stmt->execute([$offerId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function setResponse(int $offerId, string $response): void
    {
        $stmt = Database::get()->prepare('UPDATE DISPATCH_OFFER SET response = ? WHERE offer_id = ?');
        $stmt->execute([$response, $offerId]);
    }

    // Smallest approved, valid vehicle of the courier that can carry the load.
    public static function bestVehicle(int $courierId, float $weightKg, float $volumeM3): ?int
    {
        $stmt = Database::get()->prepare(
            "SELECT vehicle_id FROM VEHICLE
              WHERE courier_id = ? AND approval_status = 'approved'
                AND (insurance_expiry_date  IS NULL OR insurance_expiry_date  >= CURDATE())
                AND (inspection_expiry_date IS NULL OR inspection_expiry_date >= CURDATE())
                AND max_weight_kg >= ? AND max_vol_m3 >= ?
              ORDER BY max_weight_kg, max_vol_m3
              LIMIT 1"
        );
        $stmt->execute([$courierId, $weightKg, $volumeM3]);
        $id = $stmt->fetchColumn();
        return $id === false ? null : (int) $id;
    }

    // Accepting = new route for the courier with this order as stop 1,
    // order goes 'pending' -> 'initiated', and the change is logged.
    // All in one transaction: either everything is saved or nothing is.
    public static function assignOrder(int $offerId, int $orderId, int $courierId, int $vehicleId): void
    {
        $db = Database::get();
        $db->beginTransaction();
        try {
            $db->prepare("UPDATE DISPATCH_OFFER SET response = 'accepted' WHERE offer_id = ?")
               ->execute([$offerId]);

            $db->prepare("INSERT INTO ROUTE (courier_id, vehicle_id, status) VALUES (?, ?, 'initiated')")
               ->execute([$courierId, $vehicleId]);
            $routeId = (int) $db->lastInsertId();

            $db->prepare('INSERT INTO ROUTE_ORDER (route_id, order_id, stop_sequence) VALUES (?, ?, 1)')
               ->execute([$routeId, $orderId]);

            $db->prepare("UPDATE `ORDER` SET status = 'initiated' WHERE order_id = ?")
               ->execute([$orderId]);

            $db->prepare("INSERT INTO ORDER_STATUS_HISTORY (order_id, changed_by, old_status, new_status)
                          VALUES (?, ?, 'pending', 'initiated')")
               ->execute([$orderId, $courierId]);

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // Order the courier is working on: the one assigned most recently that is
    // still 'initiated' or 'in_progress'. Null if there is none.
    public static function activeOrderForCourier(int $courierId): ?array
    {
        $stmt = Database::get()->prepare(
            "SELECT o.order_id, o.status, o.attempt, o.origin_lat, o.origin_long, o.dest_lat, o.dest_long,
                    o.distance_km, o.price, r.route_id, r.vehicle_id
               FROM ROUTE r
               JOIN ROUTE_ORDER ro ON ro.route_id = r.route_id
               JOIN `ORDER` o      ON o.order_id  = ro.order_id
              WHERE r.courier_id = ? AND o.status IN ('initiated', 'in_progress')
              ORDER BY ro.assigned_at DESC, o.order_id DESC
              LIMIT 1"
        );
        $stmt->execute([$courierId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function orderItems(int $orderId): array
    {
        $stmt = Database::get()->prepare(
            'SELECT p.description, p.weight_kg, p.volume_m3, oi.quantity
               FROM ORDER_ITEM oi
               JOIN PRODUCT p ON p.product_id = oi.product_id
              WHERE oi.order_id = ?'
        );
        $stmt->execute([$orderId]);
        return $stmt->fetchAll();
    }

    public static function orderStatus(int $orderId): ?string
    {
        $stmt = Database::get()->prepare('SELECT status FROM `ORDER` WHERE order_id = ?');
        $stmt->execute([$orderId]);
        $s = $stmt->fetchColumn();
        return $s === false ? null : $s;
    }
}
