<?php
// GET api/courier-completed.php -> last 10 deliveries completed by the logged-in courier
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('GET');
Auth::requireRole('courier');

Response::ok(CourierService::completed(Auth::userId()));
