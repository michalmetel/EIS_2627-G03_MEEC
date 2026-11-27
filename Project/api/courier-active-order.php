<?php
// GET api/courier-active-order.php -> the order the logged-in courier is working on (or null).
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('GET');
Auth::requireRole('courier');

Response::ok(DispatchService::activeOrder(Auth::userId()));
