<?php
// Copy this file to config.php and put your own database data there.
// config.php is NOT in the repo (.gitignore), because everyone has different passwords.
return [
    'db_host' => '127.0.0.1',
    'db_name' => 'cms',
    'db_user' => 'root',
    'db_pass' => '',
    // Cloudflare Turnstile secret. This is Cloudflare's public TEST secret (always passes),
    // matching the test site key in login.js. Put the real secret here for production.
    'turnstile_secret' => '1x0000000000000000000000000000000AA',
    'debug'   => true,   // true = show error details; set to false before submission
];
