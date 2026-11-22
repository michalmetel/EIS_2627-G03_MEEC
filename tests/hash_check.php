<?php
// Run from the repo folder:
//   C:\xampp\php\php.exe tests\hash_check.php          -> only checks
//   C:\xampp\php\php.exe tests\hash_check.php fix      -> resets every @cms.pt test account to password123
//
// Checks if the password hashes saved in the USER table really match "password123".
$config = require __DIR__ . '/../Project/config/config.php';

$pdo = new PDO(
    'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
    $config['db_user'],
    $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

$fix  = ($argv[1] ?? '') === 'fix';
$rows = $pdo->query("SELECT user_id, email, role, account_status, password_hash FROM `USER` ORDER BY user_id")->fetchAll();

echo "PHP " . PHP_VERSION . " | users found: " . count($rows) . "\n\n";

foreach ($rows as $u) {
    $ok = password_verify('password123', $u['password_hash']);
    printf("%-3d %-18s %-8s %-9s password123 %s\n",
        $u['user_id'], $u['email'], $u['role'], $u['account_status'], $ok ? 'OK' : 'DOES NOT MATCH');

    if ($fix && !$ok && substr($u['email'], -7) === '@cms.pt') {
        $new  = password_hash('password123', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('UPDATE `USER` SET password_hash = ? WHERE user_id = ?');
        $stmt->execute([$new, $u['user_id']]);
        echo "    -> fixed\n";
    }
}

if (!$fix) {
    echo "\nIf any line says DOES NOT MATCH, run again with the word fix.\n";
}
