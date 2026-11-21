<?php
// DAL: the ONLY place with SQL for the USER table.
// "?" = parameter. PDO sends the value separately from the SQL, so it can never
// change the query (this is what protects us from SQL injection).
class UserRepository
{
    public static function findByEmail(string $email): ?array
    {
        $stmt = Database::get()->prepare('SELECT * FROM `USER` WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        return $user ?: null; // fetch() returns false when nothing found -> we return null
    }

    public static function findById(int $userId): ?array
    {
        $stmt = Database::get()->prepare('SELECT * FROM `USER` WHERE user_id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    // Used only by dev-login.php
    public static function findFirstApprovedByRole(string $role): ?array
    {
        $stmt = Database::get()->prepare(
            "SELECT * FROM `USER` WHERE role = ? AND account_status = 'approved' ORDER BY user_id LIMIT 1"
        );
        $stmt->execute([$role]);
        $user = $stmt->fetch();
        return $user ?: null;
    }
}
