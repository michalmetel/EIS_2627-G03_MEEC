<?php
// app/BLL/CsvService.php – business rules for CSV import/export
class CsvService
{
    private const ROLES    = ['client', 'courier', 'staff', 'admin'];
    private const STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

    public static function usersForExport(): array
    {
        return CsvRepository::allUsers();
    }

    // Returns ['imported' => n] or throws InvalidArgumentException with the list of errors
    public static function importUsers(string $tmpFile): array
    {
        $handle = fopen($tmpFile, 'r');
        if (!$handle) {
            throw new InvalidArgumentException('Cannot read file');
        }

        $header = fgetcsv($handle, 0, ';');
        if ($header) {
            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]); // remove BOM
            $header = array_map('trim', $header);
        }
        $required = ['username', 'name', 'email', 'password', 'role'];
        if (!$header || array_diff($required, $header)) {
            throw new InvalidArgumentException('Missing columns. Required: ' . implode(', ', $required));
        }

        $rows = [];
        $errors = [];
        $seenEmail = [];
        $seenUser = [];
        $line = 1;

        while (($cols = fgetcsv($handle, 0, ';')) !== false) {
            $line++;
            if ($cols === [null]) {
                continue; // empty line
            }
            if (count($cols) !== count($header)) {
                $errors[] = "Line $line: wrong number of columns";
                continue;
            }
            $r = array_combine($header, array_map('trim', $cols));

            $phone  = ($r['phone'] ?? '') !== '' ? $r['phone'] : null;
            $nif    = ($r['nif'] ?? '') !== '' ? $r['nif'] : null;
            $status = ($r['account_status'] ?? '') !== '' ? $r['account_status'] : 'approved';

            if ($r['username'] === '' || $r['name'] === '' || $r['password'] === '') {
                $errors[] = "Line $line: username, name and password are required";
            } elseif (!filter_var($r['email'], FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Line $line: invalid email";
            } elseif (!in_array($r['role'], self::ROLES, true)) {
                $errors[] = "Line $line: invalid role";
            } elseif (!in_array($status, self::STATUSES, true)) {
                $errors[] = "Line $line: invalid account_status";
            } elseif ($nif !== null && !preg_match('/^\d{9}$/', $nif)) {
                $errors[] = "Line $line: NIF must have 9 digits";
            } elseif (strlen($r['username']) > 100 || strlen($r['name']) > 100 || strlen($r['email']) > 100) {
                $errors[] = "Line $line: username, name or email too long (max 100)";
            } elseif ($phone !== null && strlen($phone) > 20) {
                $errors[] = "Line $line: phone too long (max 20)";
            } elseif (isset($seenEmail[$r['email']]) || CsvRepository::emailExists($r['email'])) {
                $errors[] = "Line $line: email already exists";
            } elseif (isset($seenUser[$r['username']]) || CsvRepository::usernameExists($r['username'])) {
                $errors[] = "Line $line: username already exists";
            } else {
                $seenEmail[$r['email']] = true;
                $seenUser[$r['username']] = true;
                $rows[] = [
                    'username'       => $r['username'],
                    'name'           => $r['name'],
                    'email'          => $r['email'],
                    'password_hash'  => password_hash($r['password'], PASSWORD_DEFAULT),
                    'phone'          => $phone,
                    'nif'            => $nif,
                    'role'           => $r['role'],
                    'account_status' => $status,
                ];
            }
        }
        fclose($handle);

        if ($errors) {
            throw new InvalidArgumentException(implode(' | ', $errors));
        }
        if (!$rows) {
            throw new InvalidArgumentException('File has no data rows');
        }

        CsvRepository::insertUsers($rows);
        return ['imported' => count($rows)];
    }
}