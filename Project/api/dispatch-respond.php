<?php
// POST api/dispatch-respond.php
// body: { "offer_id": 12, "action": "accept" | "decline" }
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('POST');
Auth::requireRole('courier');

$data = Request::json();
Request::requireFields($data, ['offer_id', 'action']);

$offerId = filter_var($data['offer_id'], FILTER_VALIDATE_INT);
if ($offerId === false || $offerId < 1) {
    Response::error('Invalid offer', 400);
}

if ($data['action'] === 'accept') {
    Response::ok(DispatchService::accept(Auth::userId(), $offerId));
} elseif ($data['action'] === 'decline') {
    DispatchService::decline(Auth::userId(), $offerId);
    Response::ok(null);
} else {
    Response::error('Action must be accept or decline', 400);
}
