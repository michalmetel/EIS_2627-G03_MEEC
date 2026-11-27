<?php
// DAL: SQL for the courier cockpit – the courier's vehicles and the delivery steps
// of an order already assigned to them (initiated -> in_progress -> completed / cancelled).
class CourierRepository
{
    public static function vehiclesOf(int $courierId): array
    {
        $stmt = Database::get()->prepare(
            'SELECT v.vehicle_id, v.license_plate, v.model, v.max_weight_kg, v.max_vol_m3,
                    v.insurance_expiry_date, v.inspection_expiry_date, v.approval_status, t.type_name
               FROM VEHICLE v
               JOIN VEHICLE_TYPE t ON t.vehicle_type_id = v.vehicle_type_id
              WHERE v.courier_id = ?
              ORDER BY v.max_weight_kg'
        );
        $stmt->execute([$courierId]);
        return $stmt->fetchAll();
    }

    public static function vehicleOf(int $courierId, int $vehicleId): ?array
    {
        $stmt = Database::get()->prepare(
            "SELECT v.*, (v.approval_status = 'approved'
                          AND (v.insurance_expiry_date  IS NULL OR v.insurance_expiry_date  >= CURDATE())
                          AND (v.inspection_expiry_date IS NULL OR v.inspection_expiry_date >= CURDATE())) AS usable
               FROM VEHICLE v
              WHERE v.vehicle_id = ? AND v.courier_id = ?"
        );
        $stmt->execute([$vehicleId, $courierId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    // The order, only if it is on a route of this courier that is not finished.
    public static function assignedOrder(int $courierId, int $orderId): ?array
    {
        $stmt = Database::get()->prepare(
            "SELECT o.order_id, o.status, o.attempt, ro.route_id, r.vehicle_id
               FROM `ORDER` o
               JOIN ROUTE_ORDER ro ON ro.order_id = o.order_id
               JOIN ROUTE r        ON r.route_id  = ro.route_id
              WHERE o.order_id = ? AND r.courier_id = ? AND r.status IN ('initiated', 'in_progress')
              ORDER BY ro.assigned_at DESC
              LIMIT 1"
        );
        $stmt->execute([$orderId, $courierId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    // initiated -> in_progress: chosen vehicle is saved on the route, parcel picked up.
    public static function startDelivery(int $courierId, int $orderId, int $routeId, int $vehicleId): void
    {
        $db = Database::get();
        $db->beginTransaction();
        try {
            $db->prepare("UPDATE ROUTE SET vehicle_id = ?, status = 'in_progress', started_at = COALESCE(started_at, NOW())
                           WHERE route_id = ?")
               ->execute([$vehicleId, $routeId]);
            $db->prepare('UPDATE ROUTE_ORDER SET picked_up_at = NOW() WHERE route_id = ? AND order_id = ?')
               ->execute([$routeId, $orderId]);
            self::changeStatus($db, $orderId, $courierId, 'initiated', 'in_progress');
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // in_progress -> completed, with the proof of delivery.
    public static function completeDelivery(int $courierId, int $orderId, int $routeId, string $podType, string $filePath): void
    {
        $db = Database::get();
        $db->beginTransaction();
        try {
            $db->prepare('INSERT INTO PROOF_OF_DELIVERY (route_id, order_id, pod_type, file_path) VALUES (?, ?, ?, ?)')
               ->execute([$routeId, $orderId, $podType, $filePath]);
            $db->prepare('UPDATE ROUTE_ORDER SET delivered_at = NOW() WHERE route_id = ? AND order_id = ?')
               ->execute([$routeId, $orderId]);
            self::changeStatus($db, $orderId, $courierId, 'in_progress', 'completed');
            self::closeRouteIfDone($db, $routeId, 'completed');
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // in_progress -> cancelled by the courier. The order goes back to 'pending' with one more
    // attempt, so the dispatch queue (WP3) offers it to a courier again.
    public static function cancelDelivery(int $courierId, int $orderId, int $routeId): void
    {
        $db = Database::get();
        $db->beginTransaction();
        try {
            self::changeStatus($db, $orderId, $courierId, 'in_progress', 'cancelled');
            $db->prepare("UPDATE `ORDER` SET status = 'pending', attempt = attempt + 1 WHERE order_id = ?")
               ->execute([$orderId]);
            $db->prepare("INSERT INTO ORDER_STATUS_HISTORY (order_id, changed_by, old_status, new_status)
                          VALUES (?, ?, 'cancelled', 'pending')")
               ->execute([$orderId, $courierId]);
            self::closeRouteIfDone($db, $routeId, 'cancelled');
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // Updates the order only if it still has the expected status, and logs the change.
    private static function changeStatus(PDO $db, int $orderId, int $userId, string $from, string $to): void
    {
        $stmt = $db->prepare('UPDATE `ORDER` SET status = ? WHERE order_id = ? AND status = ?');
        $stmt->execute([$to, $orderId, $from]);
        if ($stmt->rowCount() !== 1) {
            throw new RuntimeException('The order status changed meanwhile. Reload the page.');
        }
        $db->prepare('INSERT INTO ORDER_STATUS_HISTORY (order_id, changed_by, old_status, new_status) VALUES (?, ?, ?, ?)')
           ->execute([$orderId, $userId, $from, $to]);
    }

    // A route is finished when none of its orders is still being worked on.
    private static function closeRouteIfDone(PDO $db, int $routeId, string $finalStatus): void
    {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM ROUTE_ORDER ro JOIN `ORDER` o ON o.order_id = ro.order_id
              WHERE ro.route_id = ? AND ro.delivered_at IS NULL AND o.status IN ('initiated', 'in_progress')"
        );
        $stmt->execute([$routeId]);
        if ((int) $stmt->fetchColumn() === 0) {
            $db->prepare('UPDATE ROUTE SET status = ?, finished_at = NOW() WHERE route_id = ?')
               ->execute([$finalStatus, $routeId]);
        }
    }

    public static function completedOrders(int $courierId, int $limit): array
    {
        $stmt = Database::get()->prepare(
            "SELECT o.order_id, o.dest_lat, o.dest_long, ro.delivered_at
               FROM ROUTE r
               JOIN ROUTE_ORDER ro ON ro.route_id = r.route_id
               JOIN `ORDER` o      ON o.order_id  = ro.order_id
              WHERE r.courier_id = ? AND o.status = 'completed' AND ro.delivered_at IS NOT NULL
              ORDER BY ro.delivered_at DESC
              LIMIT " . (int) $limit
        );
        $stmt->execute([$courierId]);
        return $stmt->fetchAll();
    }
}
