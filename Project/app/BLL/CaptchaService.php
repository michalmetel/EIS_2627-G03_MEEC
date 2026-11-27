<?php
// BLL: Cloudflare Turnstile (captcha) check on the server.
// The browser widget gives a token; only Cloudflare can say if it is real, using our SECRET key.
// A token works only once and expires after 5 minutes.
// When registration moves to the server, call CaptchaService::verify() inside register.php,
// before the account is created.
class CaptchaService
{
    const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const TIMEOUT_SECONDS = 5;
    const TEST_SECRET = '1x0000000000000000000000000000000AA'; // Cloudflare's public test secret

    // true = human confirmed. Never throws: any problem counts as "not verified".
    public static function verify(string $token, ?string $ip = null): bool
    {
        if ($token === '' || strlen($token) > 2048) {
            return false;
        }
        $config = require __DIR__ . '/../../config/config.php';
        // Older config.php files have no key yet: use Cloudflare's test secret (matches the test site key)
        $secret = $config['turnstile_secret'] ?? self::TEST_SECRET;

        $fields = ['secret' => $secret, 'response' => $token];
        if ($ip !== null) {
            $fields['remoteip'] = $ip;
        }
        $context = stream_context_create(['http' => [
            'method'        => 'POST',
            'header'        => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content'       => http_build_query($fields),
            'timeout'       => self::TIMEOUT_SECONDS,
            'ignore_errors' => true,
        ]]);

        $body = @file_get_contents(self::VERIFY_URL, false, $context);
        if ($body === false) {
            return false; // Cloudflare not reachable
        }
        $result = json_decode($body, true);
        return is_array($result) && ($result['success'] ?? false) === true;
    }
}
