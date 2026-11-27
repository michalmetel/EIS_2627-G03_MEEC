/* =========================================================
   CMS – Courier Management System
   dispatch.js: WP3 – incoming delivery offers (Uber style).
   Asks the server every few seconds for an offer. When one arrives,
   a sheet slides up with the trip on a map, the price and a
   countdown ring. Accept / decline are sent to the backend.
   Needs Leaflet loaded first.
   ========================================================= */

'use strict';

(() => {
  const POLL_MS = 4000;
  const API_OFFER = '../api/dispatch-offer.php';
  const API_RESPOND = '../api/dispatch-respond.php';
  const RING_LENGTH = 2 * Math.PI * 42; // circumference of the SVG circle (r = 42)
  const URGENT_SECS = 10;

  const el = id => document.getElementById(id);
  const sheet = el('offerSheet');
  if (!sheet) return;

  let current = null;      // offer being shown
  let deadline = 0;        // Date.now() value when it expires
  let tickTimer = null;
  let pollTimer = null;
  let busy = false;        // waiting for accept/decline answer
  let offerMap = null;
  let offerLayer = null;

  function toast(text){
    const t = el('toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const eur = n => '€' + n.toFixed(2);
  const km  = n => n.toFixed(1) + ' km';

  /* ---------- Map inside the sheet ---------- */
  // Real road route between two points (OSRM public router). null if it fails.
  async function roadRoute(a, b){
    try {
      const pts = `${a[1]},${a[0]};${b[1]},${b[0]}`;
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`);
      const data = await r.json();
      const route = data.routes && data.routes[0];
      if (!route) return null;
      return {
        line: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        km: route.distance / 1000,
        min: Math.max(1, Math.round(route.duration / 60))
      };
    } catch (e) { return null; }
  }

  async function drawMap(o){
    if (!offerMap){
      // drag, scroll-wheel and pinch to explore the route
      offerMap = L.map('offerMap', { zoomControl:true });
      offerMap.attributionControl.setPrefix(false);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom:19, attribution:'&copy; OpenStreetMap'
      }).addTo(offerMap);
    }
    if (offerLayer) offerLayer.remove();

    const me   = [o.courier.lat, o.courier.lng];
    const pick = [o.pickup.lat, o.pickup.lng];
    const drop = [o.dropoff.lat, o.dropoff.lng];
    const dot = (cls) => L.divIcon({ className:'', html:`<span class="offer-pin ${cls}"></span>`, iconSize:[18,18], iconAnchor:[9,9] });

    // straight lines first, so something is visible straight away
    const toPickup = L.polyline([me, pick], { color:'#4a90e2', weight:4, dashArray:'2 9', lineCap:'round', opacity:.9 });
    const casing   = L.polyline([pick, drop], { color:'#0f1f3d', weight:8, opacity:.35 });
    const trip     = L.polyline([pick, drop], { color:'#14284b', weight:5 });
    offerLayer = L.layerGroup([toPickup, casing, trip,
      L.marker(me, { icon:dot('me') }), L.marker(pick, { icon:dot('pick') }), L.marker(drop, { icon:dot('drop') })
    ]).addTo(offerMap);

    const fit = () => offerMap.fitBounds(L.featureGroup([toPickup, trip]).getBounds(), { padding:[30,30], maxZoom:15 });
    // the map was hidden until now, so Leaflet has to measure it again
    setTimeout(() => { offerMap.invalidateSize(); fit(); }, 60);

    el('offerMapNote').textContent = 'Loading route…';
    const [a, b] = await Promise.all([roadRoute(me, pick), roadRoute(pick, drop)]);
    if (!current || current.offer_id !== o.offer_id) return;   // another offer is showing now

    if (a){ toPickup.setLatLngs(a.line); el('offerPickup').textContent = `${a.km.toFixed(1)} km · ${a.min} min`; }
    if (b){ casing.setLatLngs(b.line); trip.setLatLngs(b.line); el('offerTrip').textContent = `${b.km.toFixed(1)} km · ${b.min} min`; }
    el('offerMapNote').textContent = (a && b) ? '' : 'Road route unavailable – straight line shown';
    fit();
  }

  // Street names for the two stops (placeName comes from courier.js)
  async function drawNames(o){
    if (typeof window.placeName !== 'function') return;
    const [p, d] = await Promise.all([
      window.placeName([o.pickup.lat, o.pickup.lng]),
      window.placeName([o.dropoff.lat, o.dropoff.lng])
    ]);
    if (!current || current.offer_id !== o.offer_id) return;
    el('offerPickName').textContent = p;
    el('offerDropName').textContent = d;
  }

  /* ---------- Show / hide ---------- */
  function show(o){
    current = o;
    deadline = Date.now() + o.seconds_left * 1000;

    el('offerPrice').textContent    = eur(o.price);
    el('offerOrder').textContent    = '#' + o.order_id;
    el('offerPickup').textContent   = '~' + km(o.to_pickup_km);   // replaced by the road distance
    el('offerTrip').textContent     = km(o.trip_km);
    el('offerLoad').textContent     = `${o.weight_kg} kg · ${o.volume_m3} m³`;
    el('offerPickName').textContent = `${o.pickup.lat.toFixed(4)}, ${o.pickup.lng.toFixed(4)}`;
    el('offerDropName').textContent = `${o.dropoff.lat.toFixed(4)}, ${o.dropoff.lng.toFixed(4)}`;
    el('offerFrom').textContent     = o.courier.is_default
      ? 'Distance from FEUP (you have no deliveries yet)'
      : 'Distance from your last drop-off';
    el('offerMsg').textContent      = '';

    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('open'));
    drawMap(o);
    drawNames(o);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    clearInterval(tickTimer);
    tick();
    tickTimer = setInterval(tick, 200);
    el('offerAccept').focus();
  }

  function hide(){
    clearInterval(tickTimer);
    current = null;
    sheet.classList.remove('open', 'urgent');
    setTimeout(() => { if (!current) sheet.hidden = true; }, 300);
  }

  function tick(){
    if (!current) return;
    const left = Math.max(0, deadline - Date.now());
    const secs = Math.ceil(left / 1000);
    const part = left / (current.offer_seconds * 1000);

    el('offerSecs').textContent = secs;
    el('offerRing').style.strokeDashoffset = String(RING_LENGTH * (1 - part));
    el('offerDrain').style.transform = `scaleX(${part})`;
    sheet.classList.toggle('urgent', secs <= URGENT_SECS);

    if (left <= 0 && !busy){
      hide();
      toast('Offer missed – it went to the next courier');
      poll();
    }
  }

  /* ---------- Server ---------- */
  async function poll(){
    if (busy) return;
    try {
      const res = await fetch(API_OFFER, { credentials:'same-origin' });
      if (res.status === 401 || res.status === 403){ stop(); return; }
      const json = await res.json();
      if (!json.ok) return;

      const o = json.data;
      if (o && (!current || current.offer_id !== o.offer_id)) show(o);
      else if (!o && current) hide(); // offer no longer valid on the server
    } catch (e) {
      // server not reachable – try again on the next poll
    }
  }

  async function respond(action){
    if (!current || busy) return;
    busy = true;
    sheet.classList.add('busy');
    const offer = current;
    try {
      const res = await fetch(API_RESPOND, {
        method:'POST',
        credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ offer_id: offer.offer_id, action })
      });
      const json = await res.json();
      if (json.ok){
        hide();
        toast(action === 'accept' ? `Order #${offer.order_id} accepted – head to the pickup` : 'Offer declined');
        if (action === 'accept' && window.loadServerActiveOrder){
          await window.loadServerActiveOrder();
          window.scrollTo({ top:0, behavior:'smooth' });
        }
      } else {
        el('offerMsg').textContent = json.error;
        if (res.status === 409 || res.status === 404) setTimeout(hide, 1500);
      }
    } catch (e) {
      el('offerMsg').textContent = 'Could not reach the server. Try again.';
    } finally {
      busy = false;
      sheet.classList.remove('busy');
    }
  }

  function stop(){ clearInterval(pollTimer); pollTimer = null; }

  el('offerAccept').addEventListener('click', () => respond('accept'));
  el('offerDecline').addEventListener('click', () => respond('decline'));

  // Uber-like: you are "online" and waiting for trips while the page is open
  poll();
  pollTimer = setInterval(poll, POLL_MS);
})();
