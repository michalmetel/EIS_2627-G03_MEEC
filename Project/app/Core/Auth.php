<?php
// Who is logged in and what role they have (stored in the PHP session).
class Auth
{
    public static function login(array $user): void
    {
        session_regenerate_id(true); // new session id after login (protects against session hijacking)
        $_SESSION['user_id'] = (int) $user['user_id'];
        $_SESSION['role']    = $user['role'];
        $_SESSION['name']    = $user['name'];
    }

    public static function logout(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    public static function userId(): ?int
    {
        return $_SESSION['user_id'] ?? null;
    }

    public static function role(): ?string
    {
        return $_SESSION['role'] ?? null;
    }

    public static function name(): ?string
    {
        return $_SESSION['name'] ?? null;
    }

    // Use at the top of an endpoint that needs a logged-in user.
    public static function requireLogin(): void
    {
        if (self::userId() === null) {
            Response::error('You must be logged in', 401);
        }
    }

    // Example: Auth::requireRole('staff', 'admin');
    public static function requireRole(string ...$roles): void
    {
        self::requireLogin();
        if (!in_array(self::role(), $roles, true)) {
            Response::error('You do not have permission', 403);
        }
    }
}
