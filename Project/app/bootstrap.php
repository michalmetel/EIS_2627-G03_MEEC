<?php
// Include this file at the top of every API endpoint:
// require_once __DIR__ . '/../app/bootstrap.php';

// Autoloader: when a class is used for the first time (e.g. UserRepository),
// PHP looks for a file with the same name in Core/, DAL/ and BLL/ and loads it.
// So a new class only needs a file named exactly like the class – no extra require.
spl_autoload_register(function (string $class) {
    foreach (['Core', 'DAL', 'BLL'] as $folder) {
        $file = __DIR__ . '/' . $folder . '/' . $class . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

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
