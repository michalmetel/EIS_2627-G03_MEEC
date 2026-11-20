<?php
// GET api/me.php -> who is logged in (used by auth.js on every protected page)
require_once __DIR__ . '/../app/bootstrap.php';

Auth::requireLogin();

Response::ok([
    'user_id' => Auth::userId(),
    'name'    => Auth::name(),
    'role'    => Auth::role(),
]);
