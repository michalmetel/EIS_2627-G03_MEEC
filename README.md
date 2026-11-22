# ParcelApp

## Run the site

From the project folder:

```
python3 run.py
```

On Windows (PowerShell or cmd) use `python run.py`. It starts the web server and opens the home page in your browser. Press `Ctrl+C` to stop it. Only Python 3 is needed, nothing to install.

Use the server instead of opening the HTML files directly: OpenStreetMap doesn't load map tiles for pages opened from disk.

Options: `--port 9000` to choose another port, `--no-browser` to not open the browser.

## Login

The Courier, Staff and Admin pages ask for a login first (`Project/Assets/js/auth.js`). The Client page is public and only asks for a login when an order is submitted; the order is kept and sent after the login. There is no backend yet, so any valid email with a password of 6+ characters is accepted, and the check only runs in the browser. It has to move to the server in the backend sprint.

Until then `Project/Assets/js/store.js` keeps sample data in the browser's `localStorage`, so the pages work together: couriers who register appear on the Staff page, staff and admins on the Admin page, and they can log in once approved. New certificates alert Staff, and new orders can be tracked. Passwords, phones and NIFs are never stored.

## Styles

Every page loads `Project/Assets/css/common.css` first (colours, background, top bar, navbar, footer), then its own stylesheet for what is specific to that page.

## Database

## 1. Set up your local database 
 
1. Start **Apache** and **MySQL** in XAMPP.
2. Copy `Project/config/config.example.php` to `Project/config/config.php` (never commit it).
3. Open `http://localhost/phpmyadmin` → **Import** → choose `database/cms.sql` → **Go**.
4. Check that the `cms` database now has `USER` and `PRICING_SETTINGS`.

## 2. Which server to use
 
The backend needs PHP, so **do not use `python run.py`** for anything that calls `api/`. It only serves
static files and `POST` requests fail with `501 Unsupported method`.

go to http://localhost/EIS_2627-G03_MEEC/Project/Pages/login.html or any other pages directly in the browser, it should work.

If the repo is not inside `C:\xampp\htdocs`, create a folder link (PowerShell):

```
New-Item -ItemType Junction -Path "C:\xampp\htdocs\EIS_2627-G03_MEEC" -Target "<path to your repo>"
```

## 4. Test accounts
 
Password for all of them: `password123`
 
| Email | Role | Status |
|---|---|---|
| client@cms.pt | client | approved |
| courier@cms.pt | courier | approved |
| staff@cms.pt | staff | approved |
| admin@cms.pt | admin | approved |
| courier2@cms.pt | courier | pending (to test approvals) |
| staff2@cms.pt | staff | pending (to test approvals) |
