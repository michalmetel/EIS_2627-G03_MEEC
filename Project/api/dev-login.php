<?php
// GET api/dev-login.php?role=courier
// FOR TESTING ONLY: logs you in as the first approved user with this role.
// Works only when 'debug' => true in config.php. DELETE THIS FILE BEFORE SUBMISSION.
require_once __DIR__ . '/../app/bootstrap.php';

if (!$config['debug']) {
    Response::error('Not found', 404);
}

$role = $_GET['role'] ?? '';
$user = UserRepository::findFirstApprovedByRole($role);

if ($user === null) {
    Response::error('No approved user with role: ' . $role, 404);
}

Auth::login($user);
Response::ok([
    'user_id' => (int) $user['user_id'],
    'name'    => $user['name'],
    'role'    => $user['role'],
]);
