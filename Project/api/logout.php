<?php
// POST api/logout.php -> ends the session
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('POST');

Auth::logout();
Response::ok();
