<?php
// api/csv.php
// GET  api/csv.php?action=export  -> downloads users.csv
// POST api/csv.php?action=import  -> multipart upload, field name "file"
require_once __DIR__ . '/../app/bootstrap.php';

Auth::requireRole('admin');

$action = $_GET['action'] ?? '';

if ($action === 'export') {
    Request::requireMethod('GET');
    $rows = CsvService::usersForExport();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="users.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel reads accents
    fputcsv($out, $rows ? array_keys($rows[0]) : ['user_id', 'username', 'name', 'email', 'phone', 'nif', 'role', 'account_status', 'created_at'], ';');
    foreach ($rows as $r) {
        fputcsv($out, $r, ';');
    }
    fclose($out);
    exit;
}

if ($action === 'import') {
    Request::requireMethod('POST');
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        Response::error('No file uploaded', 422);
    }
    try {
        Response::ok(CsvService::importUsers($_FILES['file']['tmp_name']));
    } catch (InvalidArgumentException $e) {
        Response::error($e->getMessage(), 400);
    }
}

Response::error('Unknown action', 400);