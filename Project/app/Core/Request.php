<?php
// Reading data sent by the frontend.
class Request
{
    // Stops with 405 if the endpoint was called with a different HTTP method.
    public static function requireMethod(string $method): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== $method) {
            Response::error('Use ' . $method, 405);
        }
    }

    // fetch() with JSON body -> PHP array
    public static function json(): array
    {
        $body = file_get_contents('php://input');
        $data = json_decode($body, true);
        return is_array($data) ? $data : [];
    }

    // Stops with 422 if any required field is missing or empty.
    public static function requireFields(array $data, array $fields): void
    {
        foreach ($fields as $field) {
            if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
                Response::error('Missing field: ' . $field, 422);
            }
        }
    }
}
