<?php
// GET api/me.php -> who is logged in (used by auth.js on every protected page)
require_once __DIR__ . '/../app/bootstrap.php';

Auth::requireLogin();

$user = UserRepository::findById(Auth::userId());

// The account was deleted while the user was logged in.
if ($user === null) {
    Auth::logout();
    Response::error('You must be logged in', 401);
}

Response::ok([
    'user_id' => (int) $user['user_id'],
    'name'    => $user['name'],
    'email'   => $user['email'],
    'role'    => $user['role'],
]);
