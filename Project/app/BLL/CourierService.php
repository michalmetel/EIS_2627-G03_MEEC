<?php
// BLL: courier cockpit – vehicles and the delivery steps of an assigned order.
//   initiated  --start()-->    in_progress  (vehicle chosen, parcel picked up)
//   in_progress --complete()-> completed    (proof of delivery required)
//   in_progress --cancel()-->  back to 'pending' for the dispatch queue (attempt + 1)
//
// Other work packages plug in at the marked points (search for "WP4" / "WP5").
class CourierService
{
    const POD_DIR       = __DIR__ . '/../../uploads/pod/'; // Project/uploads/pod/ (not in git)
    const POD_MAX_BYTES = 8 * 1024 * 1024;
    const POD_TYPES     = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];

    public static function vehicles(int $courierId): array
    {
        $today = date('Y-m-d');
        $list = [];
        foreach (CourierRepository::vehiclesOf($courierId) as $v) {
            $ins = $v['insurance_expiry_date'];
            $insp = $v['inspection_expiry_date'];
            $list[] = [
                'vehicle_id' => (int) $v['vehicle_id'],
                'model'      => $v['model'],
                'plate'      => $v['license_plate'],
                'type'       => $v['type_name'],
                'max_kg'     => (float) $v['max_weight_kg'],
                'max_m3'     => (float) $v['max_vol_m3'],
                'insurance'  => $ins,
                'inspection' => $insp,
                'approved'   => $v['approval_status'] === 'approved',
                'usable'     => $v['approval_status'] === 'approved'
                                && ($ins === null || $ins >= $today)
                                && ($insp === null || $insp >= $today),
            ];
        }
        return $list;
    }

    public static function completed(int $courierId): array
    {
        return array_map(fn($o) => [
            'order_id'     => (int) $o['order_id'],
            'dest'         => [(float) $o['dest_lat'], (float) $o['dest_long']],
            'delivered_at' => $o['delivered_at'],
        ], CourierRepository::completedOrders($courierId, 10));
    }

    // initiated -> in_progress
    public static function start(int $courierId, int $orderId, int $vehicleId): void
    {
        $order = self::orderInStatus($courierId, $orderId, 'initiated');

        $vehicle = CourierRepository::vehicleOf($courierId, $vehicleId);
        if ($vehicle === null) {
            Response::error('Vehicle not found', 404);
        }
        if (!(int) $vehicle['usable']) {
            Response::error('This vehicle is not approved or its documents expired', 409);
        }
        $load = DispatchRepository::orderLoad($orderId);
        if ((float) $load['weight_kg'] > (float) $vehicle['max_weight_kg']
            || (float) $load['volume_m3'] > (float) $vehicle['max_vol_m3']) {
            Response::error("This order doesn't fit in the {$vehicle['model']}. Pick a larger vehicle.", 409);
        }

        // WP4 (re-weighting): the courier weighs the parcel at pickup. If the real weight is
        // higher than declared, WP4 starts the RTO flow here instead of continuing.

        self::run(fn() => CourierRepository::startDelivery($courierId, $orderId, (int) $order['route_id'], $vehicleId));
    }

    // in_progress -> completed. $file is one entry of $_FILES (signature PNG or photo).
    public static function complete(int $courierId, int $orderId, string $podType, ?array $file): void
    {
        $order = self::orderInStatus($courierId, $orderId, 'in_progress');

        if (!in_array($podType, ['signature', 'photo'], true)) {
            Response::error('Proof of delivery must be a signature or a photo', 400);
        }
        if ($file === null || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('Proof of delivery is mandatory', 422);
        }
        if ($file['size'] > self::POD_MAX_BYTES) {
            Response::error('The file is larger than 8 MB', 400);
        }
        // Check the real content, not the name the browser sent
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!isset(self::POD_TYPES[$mime])) {
            Response::error('The proof of delivery must be a PNG, JPG or WEBP image', 400);
        }

        // WP5 (delivery code): check the code typed by the courier against ORDER.delivery_code
        // here and stop with an error if it does not match.

        if (!is_dir(self::POD_DIR) && !mkdir(self::POD_DIR, 0775, true)) {
            throw new RuntimeException('Could not create the upload folder');
        }
        $name = 'order_' . $orderId . '_' . $podType . '_' . time() . '.' . self::POD_TYPES[$mime];
        if (!move_uploaded_file($file['tmp_name'], self::POD_DIR . $name)) {
            throw new RuntimeException('Could not save the proof of delivery');
        }

        self::run(fn() => CourierRepository::completeDelivery(
            $courierId, $orderId, (int) $order['route_id'], $podType, 'uploads/pod/' . $name
        ));
    }

    // in_progress -> cancelled -> pending (back to the dispatch queue)
    public static function cancel(int $courierId, int $orderId, string $reason): void
    {
        $order = self::orderInStatus($courierId, $orderId, 'in_progress');
        if (mb_strlen(trim($reason)) < 5) {
            Response::error('The reason is too short (at least 5 characters)', 422);
        }
        self::run(fn() => CourierRepository::cancelDelivery($courierId, $orderId, (int) $order['route_id']));
    }

    private static function orderInStatus(int $courierId, int $orderId, string $status): array
    {
        $order = CourierRepository::assignedOrder($courierId, $orderId);
        if ($order === null) {
            Response::error('This order is not assigned to you', 404);
        }
        if ($order['status'] !== $status) {
            Response::error('The order is not in the right step for this action. Reload the page.', 409);
        }
        return $order;
    }

    // The repository throws if the status changed meanwhile -> answer 409 instead of 500.
    private static function run(callable $step): void
    {
        try {
            $step();
        } catch (RuntimeException $e) {
            Response::error($e->getMessage(), 409);
        }
    }
}
