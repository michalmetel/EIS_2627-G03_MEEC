<?php
// Include this file at the top of every API endpoint:
// require_once __DIR__ . '/../app/bootstrap.php';

require_once __DIR__ . '/Core/Database.php';
require_once __DIR__ . '/Core/Response.php';
require_once __DIR__ . '/Core/Auth.php';
require_once __DIR__ . '/Core/Request.php';

$config = require __DIR__ . '/../config/config.php';

// Any uncaught error becomes a JSON 500 response instead of an HTML error page.
set_exception_handler(function (Throwable $e) use ($config) {
    $message = $config['debug'] ? $e->getMessage() : 'Server error';
    Response::error($message, 500);
});

// Session cookie: not readable from JavaScript, not sent from other sites.
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();
