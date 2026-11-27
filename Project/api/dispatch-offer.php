<?php
// GET api/dispatch-offer.php -> the delivery offer the logged-in courier must answer now (or null).
// The courier page calls this every few seconds; each call also moves the dispatch queue forward.
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('GET');
Auth::requireRole('courier');

Response::ok(DispatchService::currentOffer(Auth::userId()));
