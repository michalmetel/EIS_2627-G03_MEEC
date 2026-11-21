<?php
// POST api/login.php
// body: { "email": "...", "password": "...", "role": "courier" }
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('POST');

$data = Request::json();
Request::requireFields($data, ['email', 'password', 'role']);

$user = AuthService::login(trim($data['email']), $data['password'], $data['role']);

Response::ok([
    'user_id' => (int) $user['user_id'],
    'name'    => $user['name'],
    'role'    => $user['role'],
]);
