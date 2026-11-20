<?php
// One shared database connection (PDO) for the whole request.
class Database
{
    private static ?PDO $pdo = null;

    public static function get(): PDO
    {
        // Connect only the first time; later calls return the same connection.
        if (self::$pdo === null) {
            $config = require __DIR__ . '/../../config/config.php';
            $dsn = 'mysql:host=' . $config['db_host']
                 . ';dbname=' . $config['db_name']
                 . ';charset=utf8mb4';

            self::$pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // SQL errors throw exceptions
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // rows as ['column' => value]
            ]);
        }
        return self::$pdo;
    }
}
