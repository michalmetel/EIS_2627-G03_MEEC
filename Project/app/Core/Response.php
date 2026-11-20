<?php
// Every endpoint answers in the same JSON format:
// { "ok": true, "data": ... }  or  { "ok": false, "error": "..." }
class Response
{
    public static function ok($data = null): void
    {
        self::send(['ok' => true, 'data' => $data], 200);
    }

    public static function error(string $message, int $status = 400): void
    {
        self::send(['ok' => false, 'error' => $message], $status);
    }

    private static function send(array $body, int $status): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body);
        exit; // stop the script after sending the answer
    }
}
