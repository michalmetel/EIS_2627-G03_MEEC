<?php
// GET api/courier-vehicles.php -> vehicles of the logged-in courier
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('GET');
Auth::requireRole('courier');

Response::ok(CourierService::vehicles(Auth::userId()));
