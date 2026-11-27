<?php
// POST api/captcha-verify.php
// body: { "token": "<token from the Turnstile widget>" }
// Used by the register form while accounts are still saved in the browser.
// Once register.php exists, the check must happen there instead (a token works only once).
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('POST');

$data = Request::json();
Request::requireFields($data, ['token']);

if (!CaptchaService::verify((string) $data['token'], $_SERVER['REMOTE_ADDR'] ?? null)) {
    Response::error("The captcha could not be verified. Please try again.", 400);
}

Response::ok(['verified' => true]);
