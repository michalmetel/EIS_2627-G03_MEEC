<?php
// POST api/courier-order-status.php – delivery steps of an order assigned to the courier
//   start:    JSON { "order_id": 2, "action": "start", "vehicle_id": 1 }
//   cancel:   JSON { "order_id": 2, "action": "cancel", "reason": "Recipient not at the address" }
//   complete: multipart/form-data: order_id, action=complete, pod_type=signature|photo, file=<image>
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('POST');
Auth::requireRole('courier');

// complete sends a file, so it comes as form data instead of JSON
$data = empty($_POST) ? Request::json() : $_POST;
Request::requireFields($data, ['order_id', 'action']);

$orderId = filter_var($data['order_id'], FILTER_VALIDATE_INT);
if ($orderId === false || $orderId < 1) {
    Response::error('Invalid order', 400);
}
$courierId = Auth::userId();

switch ($data['action']) {
    case 'start':
        Request::requireFields($data, ['vehicle_id']);
        $vehicleId = filter_var($data['vehicle_id'], FILTER_VALIDATE_INT);
        if ($vehicleId === false) {
            Response::error('Invalid vehicle', 400);
        }
        CourierService::start($courierId, $orderId, $vehicleId);
        Response::ok(['status' => 'in_progress']);

    case 'complete':
        Request::requireFields($data, ['pod_type']);
        CourierService::complete($courierId, $orderId, $data['pod_type'], $_FILES['file'] ?? null);
        Response::ok(['status' => 'completed']);

    case 'cancel':
        Request::requireFields($data, ['reason']);
        CourierService::cancel($courierId, $orderId, $data['reason']);
        Response::ok(['status' => 'pending']);

    default:
        Response::error('Action must be start, complete or cancel', 400);
}
