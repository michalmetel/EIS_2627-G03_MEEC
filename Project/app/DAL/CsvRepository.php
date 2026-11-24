<?php
// app/DAL/CsvRepository.php – the only place with SQL for CSV operations
class CsvRepository
{
    public static function allUsers(): array
    {
        // NEVER select password_hash for export
        $stmt = Database::get()->prepare(
            'SELECT user_id, username, name, email, phone, nif, role, account_status, created_at
             FROM `USER` ORDER BY user_id'
        );
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function emailExists(string $email): bool
    {
        $stmt = Database::get()->prepare('SELECT 1 FROM `USER` WHERE email = ?');
        $stmt->execute([$email]);
        return (bool) $stmt->fetchColumn();
    }

    public static function usernameExists(string $username): bool
    {
        $stmt = Database::get()->prepare('SELECT 1 FROM `USER` WHERE username = ?');
        $stmt->execute([$username]);
        return (bool) $stmt->fetchColumn();
    }

    // Inserts all rows or none (transaction)
    public static function insertUsers(array $rows): void
    {
        $pdo = Database::get();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO `USER` (username, name, email, password_hash, phone, nif, role, account_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($rows as $r) {
                $stmt->execute([
                    $r['username'], $r['name'], $r['email'], $r['password_hash'],
                    $r['phone'], $r['nif'], $r['role'], $r['account_status'],
                ]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}


