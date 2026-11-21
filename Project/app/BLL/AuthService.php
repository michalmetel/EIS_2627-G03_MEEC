<?php
// BLL: rules for logging in.
class AuthService
{
    // Returns the user if everything is OK, otherwise stops with an error response.
    public static function login(string $email, string $password, string $role): array
    {
        $user = UserRepository::findByEmail($email);

        // One message for both cases, so nobody can check which emails have accounts.
        if ($user === null || !password_verify($password, $user['password_hash'])) {
            Response::error('Wrong email or password', 401);
        }

        // The role comes from the tab on the login page.
        if ($user['role'] !== $role) {
            Response::error('This account is registered as ' . $user['role'] . '. Use that tab.', 403);
        }

        if ($user['account_status'] === 'pending') {
            Response::error('Your account is waiting for approval', 403);
        }
        if ($user['account_status'] !== 'approved') {
            Response::error('Your account is not active', 403);
        }

        Auth::login($user);
        return $user;
    }
}
