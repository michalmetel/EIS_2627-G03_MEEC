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

## Styles

Every page loads `Project/Assets/css/common.css` first (colours, background, top bar, navbar, footer), then its own stylesheet for what is specific to that page.
