# Backend – rules for the team (Sprint 2)

## 1. Setup (once)

**PHP + MySQL** – either XAMPP (start Apache + MySQL) or on Mac with Homebrew:
```
brew install php mysql
brew services start mysql
```

**Database** – import the SQL files from `database/` (phpMyAdmin → Import, or):
```
mysql -u root < database/00_core_temp.sql
```

**Config** – copy the example and put your own DB data there (password is empty on a fresh XAMPP/Homebrew):
```
cp Project/config/config.example.php Project/config/config.php
```
`config.php` is in `.gitignore` – never commit it.

**Run** (without XAMPP), from the repo folder:
```
php -S localhost:8000
```
Open `http://localhost:8000/Project/api/me.php` → you should see `{"ok":false,"error":"You must be logged in"}`.

## 2. Folder structure (3-tier)

```
Project/
├── api/          endpoints (one file = one URL). Read request → call BLL → send Response
├── app/
│   ├── bootstrap.php   include at the top of every endpoint
│   ├── Core/     Database, Response, Auth, Request – shared, do not change without asking Michał
│   ├── BLL/      business rules (XxxService.php)
│   └── DAL/      SQL – ONLY here (XxxRepository.php)
└── config/
```

Rules:
1. **SQL only in `DAL/`**, always with `prepare()` and `?` (no variables inside the SQL string).
2. **File name = class name** (`OrderRepository.php` → `class OrderRepository`). The autoloader in `bootstrap.php` loads it automatically.
3. **Every endpoint answers with `Response::ok()` or `Response::error()`** – never `echo`.
4. **Validate in JS and again in PHP** – the frontend can be bypassed.
5. **Passwords**: `password_hash()` to save, `password_verify()` to check.

## 3. Response format

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": "Message for the user" }
```

HTTP codes: 200 OK, 400 bad data, 401 not logged in, 403 no permission, 404 not found, 405 wrong method, 409 conflict (e.g. email taken), 422 missing fields, 500 server error.

## 4. Template endpoint

```php
<?php
// POST api/orders.php – create an order (example)
require_once __DIR__ . '/../app/bootstrap.php';

Request::requireMethod('POST');
Auth::requireRole('client');                 // who can call it

$data = Request::json();                      // body sent by fetch()
Request::requireFields($data, ['weight_kg', 'volume_m3']);

$order = OrderService::create(Auth::userId(), $data);   // BLL does the rules, DAL does the SQL

Response::ok($order);
```

And in JS:
```js
const res = await fetch('../api/orders.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ weight_kg: 3, volume_m3: 0.02 })
});
const json = await res.json();
if (json.ok) { /* use json.data */ } else { alert(json.error); }
```

## 5. Ready to use

| What | How |
|---|---|
| Who is logged in | `Auth::userId()`, `Auth::role()`, `Auth::name()`; in JS: `GET api/me.php` |
| Allow only some roles | `Auth::requireRole('staff', 'admin');` |
| Database connection | `Database::get()` (only inside DAL) |
| Order price | `PricingService::calculate($distanceKm, $weightKg, $volumeM3)` → array with `total` and the breakdown |

Endpoints already done: `login.php` (POST), `logout.php` (POST), `me.php` (GET), `dev-login.php` (GET).

## 6. Test accounts

Password for all: `password123`

| Role | Email |
|---|---|
| client | client@cms.pt |
| courier | courier@cms.pt |
| staff | staff@cms.pt |
| admin | admin@cms.pt |

**Quick login without the form** (only while `debug` is true):
`http://localhost:8000/Project/api/dev-login.php?role=courier` – then open your page in the same browser.
This file will be deleted before submission.

## 7. Database while Hugo is away

Need a table that does not exist yet? Create it **exactly as in the ER diagram** in your own file
`database/NN_<module>_temp.sql` (e.g. `02_orders_temp.sql`). Hugo will merge everything into one `cms.sql`.
