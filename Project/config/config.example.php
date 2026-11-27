<?php
// Copy this file to config.php and put your own database data there.
// config.php is NOT in the repo (.gitignore), because everyone has different passwords.
return [
    'db_host' => '127.0.0.1',
    'db_name' => 'cms',
    'db_user' => 'root',
    'db_pass' => '',
    // Cloudflare Turnstile secret key (free widget, hostnames: localhost, 127.0.0.1).
    // Must match the site key in Assets/js/login.js.
    'turnstile_secret' => '0x4AAAAAAGVPeGO4LZDfdHVrnhtSzkjtwBQ',
    'debug'   => true,   // true = show error details; set to false before submission
];
