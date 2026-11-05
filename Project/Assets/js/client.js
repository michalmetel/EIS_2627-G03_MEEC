'use strict';

const menuBtn = document.getElementById('menuToggle');
const nav = document.getElementById('mainNav');

if (menuBtn && nav) {
  menuBtn.addEventListener('click', function () {
    nav.classList.toggle('open');
  });
}


// create the map around porto
const map = L.map('map').setView([41.1579, -8.6291], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
  referrerPolicy: 'no-referrer-when-downgrade'
}).addTo(map);

let originMarker;
let destinationMarker;
let line;
let routeRequest = 0;
let picking = 'origin';

const streetKeys = { origin: '', dest: '' };
const streetCache = {};
const suggestions = { origin: [], dest: [] };
const activeSuggestion = { origin: -1, dest: -1 };
const suggestTimers = {};
const suggestAborts = {};
const deliveryCache = {};
let deliveryCheck = Promise.resolve('');
const MAX_ROAD_DISTANCE = 500;
let nominatimQueue = Promise.resolve();

// the page is public: the login is only asked for when an order is submitted
const DRAFT_KEY = 'cmsOrderDraft';
const ORDERS_KEY = 'cms.orders';
const draftFields = ['originLat', 'originLng', 'destLat', 'destLng'];
const productFields = ['description', 'category', 'weight', 'volume'];
let productCount = 0;
const loggedIn = sessionStorage.getItem('cmsRole') === 'client';

document.getElementById('authLinks').hidden = loggedIn;
document.getElementById('userBox').hidden = !loggedIn;
document.getElementById('statusSection').hidden = !loggedIn;

// the Back button can restore this page from memory after a login or logout
window.addEventListener('pageshow', function (e) {
  if (e.persisted && (sessionStorage.getItem('cmsRole') === 'client') !== loggedIn) {
    window.location.reload();
  }
});


// parseFloat, not Number: an empty field must be invalid instead of 0
function getCoords() {
  return {
    originLat: parseFloat(document.getElementById('originLat').value),
    originLng: parseFloat(document.getElementById('originLng').value),
    destLat: parseFloat(document.getElementById('destLat').value),
    destLng: parseFloat(document.getElementById('destLng').value)
  };
}


function coordsOk(c) {

  if (c.originLat < -90 || c.originLat > 90) return false;
  if (c.destLat < -90 || c.destLat > 90) return false;

  if (c.originLng < -180 || c.originLng > 180) return false;
  if (c.destLng < -180 || c.destLng > 180) return false;

  if (isNaN(c.originLat) || isNaN(c.originLng) ||
      isNaN(c.destLat) || isNaN(c.destLng)) return false;

  // origin and destination should not be the same point
  if (c.originLat === c.destLat && c.originLng === c.destLng) return false;

  return true;
}


function updateMap() {

  const c = getCoords();

  if (!coordsOk(c)) {
    routeRequest++;
    deliveryCheck = Promise.resolve('');
    document.getElementById('routeInfo').textContent = 'Check the coordinates.';
    document.getElementById('deliveryMsg').textContent = '';
    document.getElementById('deliveryNote').textContent = '';
    return;
  }

  const origin = [c.originLat, c.originLng];
  const destination = [c.destLat, c.destLng];

  if (originMarker) map.removeLayer(originMarker);
  if (destinationMarker) map.removeLayer(destinationMarker);
  if (line) map.removeLayer(line);

  // same markers as the courier page
  originMarker = L.circleMarker(origin, {
    radius: 8,
    color: '#14284b',
    weight: 3,
    fillColor: '#fff',
    fillOpacity: 1
  }).addTo(map);
  destinationMarker = L.marker(destination).addTo(map);

  originMarker.bindPopup('Origin');
  destinationMarker.bindPopup('Destination');

  const originCheck = pointCheck(c.originLat, c.originLng);
  const destCheck = pointCheck(c.destLat, c.destLng);
  const routeProblem = drawRoute(origin, destination, [originCheck, destCheck]);
  const request = routeRequest;

  // water or no road route block the order, far from a road is only a warning
  deliveryCheck = Promise.all([originCheck, destCheck, routeProblem]).then(function (answers) {
    if (answers[0][0] || answers[1][0]) return 'Location invalid. Choose a valid location.';
    return answers[2];
  });

  Promise.all([deliveryCheck, originCheck, destCheck]).then(function (answers) {

    if (request !== routeRequest) return;

    const far = answers[1][1] > MAX_ROAD_DISTANCE || answers[2][1] > MAX_ROAD_DISTANCE;

    document.getElementById('deliveryMsg').textContent = answers[0];
    document.getElementById('deliveryNote').textContent = far && !answers[0]
      ? 'Warning: this location is more than ' + MAX_ROAD_DISTANCE + ' m from a road. A courier may not be able to reach it.'
      : '';
  });

  document.getElementById('originText').textContent =
    '(' + c.originLat.toFixed(4) + ', ' + c.originLng.toFixed(4) + ')';

  document.getElementById('destText').textContent =
    '(' + c.destLat.toFixed(4) + ', ' + c.destLng.toFixed(4) + ')';

  showStreet('origin', c.originLat, c.originLng);
  showStreet('dest', c.destLat, c.destLng);
}


function formatKm(metres) {
  return (metres / 1000).toFixed(1) + ' km';
}


function drawRoute(origin, destination, pointChecks) {

  const request = ++routeRequest;
  const info = document.getElementById('routeInfo');

  // straight line first, so there is always a route on the map
  line = L.polyline([origin, destination], {
    color: '#2f5d9e',
    weight: 4,
    dashArray: '8 8',
    opacity: .9
  }).addTo(map);

  map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 16 });
  info.textContent = formatKm(map.distance(origin, destination)) + ' straight line';

  // then swap it for the real road route (OSRM, free public router, no API key)
  const points = origin[1] + ',' + origin[0] + ';' + destination[1] + ',' + destination[0];

  return fetch('https://router.project-osrm.org/route/v1/driving/' + points + '?overview=full&geometries=geojson')
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      return Promise.all(pointChecks).then(function (points) {

        // with no road between them OSRM can still answer "Ok", with a route that ends at the
        // closest point it can reach: much further away than the nearest road to that point
        const moved = (data.waypoints || []).some(function (point, i) {
          return point.distance > points[i][1] + MAX_ROAD_DISTANCE;
        });

        if (data.code === 'NoRoute' || moved) {
          if (request === routeRequest) info.textContent = 'No road route';
          return 'There is no road between the origin and the destination.';
        }

        const route = data.routes && data.routes[0];

        // no route, or the points changed in the meantime
        if (!route || request !== routeRequest) return '';

        const road = route.geometry.coordinates.map(function (p) {
          return [p[1], p[0]];
        });

        line.setLatLngs(road).setStyle({ dashArray: null, weight: 5 });
        map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 16 });

        info.textContent = formatKm(route.distance) + ' · ~' +
          Math.max(1, Math.round(route.duration / 60)) + ' min by road';

        return '';
      });
    })
    .catch(function () {
      // keep the straight line
      return '';
    });
}


// Nominatim: OpenStreetMap's free address service, no API key.
// its rules allow 1 request per second, so every request waits in this queue.
function nominatim(path) {

  const answer = nominatimQueue.then(function () {
    return fetch('https://nominatim.openstreetmap.org/' + path);
  }).then(function (r) {
    return r.ok ? r.json() : Promise.reject(r.status);
  });

  nominatimQueue = answer.catch(function () {}).then(function () {
    return new Promise(function (resolve) {
      setTimeout(resolve, 1100);
    });
  });

  return answer;
}


// coordinates to street name, answers are kept to avoid asking twice
function lookupStreet(lat, lng) {

  const key = lat.toFixed(5) + ',' + lng.toFixed(5);

  if (streetCache[key]) return streetCache[key];

  const answer = nominatim('reverse?format=jsonv2&zoom=18&lat=' + lat + '&lon=' + lng)
    .then(streetLabel);

  // a failed lookup can be tried again later
  answer.catch(function () {
    delete streetCache[key];
  });

  streetCache[key] = answer;
  return answer;
}


// street name to coordinates, suggested while typing. Photon is made for this
// (OpenStreetMap data, no API key, Nominatim's rules don't allow search-as-you-type).
// It searches the whole world, places near Porto come first.
function suggestStreets(point) {

  const query = document.getElementById(point + 'Search').value.trim();
  const msg = document.getElementById(point + 'SearchMsg');

  stopSuggesting(point);
  msg.textContent = '';

  if (query.length < 3) {
    closeSuggestions(point);
    return;
  }

  suggestTimers[point] = setTimeout(function () {

    const abort = new AbortController();
    suggestAborts[point] = abort;

    fetch('https://photon.komoot.io/api/?limit=12&lat=41.15&lon=-8.61&q=' + encodeURIComponent(query),
          { signal: abort.signal })
      .then(function (r) {
        return r.ok ? r.json() : Promise.reject(r.status);
      })
      .then(function (data) {
        showSuggestions(point, data.features);
      })
      .catch(function (error) {
        if (error.name === 'AbortError') return;
        closeSuggestions(point);
        msg.textContent = 'Street search is unavailable right now. Enter the coordinates or click the map.';
      });
  }, 250);
}


function stopSuggesting(point) {
  clearTimeout(suggestTimers[point]);
  if (suggestAborts[point]) suggestAborts[point].abort();
}


function placeLabel(place) {

  const p = place.properties;
  const name = p.housenumber && p.street ? p.street + ' ' + p.housenumber : p.name || p.street;

  return [name, p.city || p.county || p.state, p.country].filter(function (part, i, parts) {
    return part && parts.indexOf(part) === i;
  }).join(', ');
}


function showSuggestions(point, places) {

  const results = document.getElementById(point + 'Results');
  const input = document.getElementById(point + 'Search');
  const labels = [];

  // long streets come back once per segment: show each name only once
  suggestions[point] = places.filter(function (place) {
    const label = placeLabel(place);
    if (labels.includes(label)) return false;
    labels.push(label);
    return true;
  }).slice(0, 6);

  activeSuggestion[point] = -1;
  results.replaceChildren();

  suggestions[point].forEach(function (place, i) {
    const item = document.createElement('li');

    item.setAttribute('role', 'option');
    item.textContent = labels[i];

    // mousedown, so the input keeps the focus and the list isn't closed by the blur
    item.addEventListener('mousedown', function (e) {
      e.preventDefault();
      usePlace(point, place);
    });

    results.appendChild(item);
  });

  input.setAttribute('aria-expanded', String(labels.length > 0));

  if (labels.length === 0) {
    document.getElementById(point + 'SearchMsg').textContent = 'No matches. Check the spelling or try adding the city.';
  }
}


function closeSuggestions(point) {
  suggestions[point] = [];
  activeSuggestion[point] = -1;
  document.getElementById(point + 'Results').replaceChildren();
  document.getElementById(point + 'Search').setAttribute('aria-expanded', 'false');
}


function moveSuggestion(point, step) {

  const count = suggestions[point].length;

  if (count === 0) return;

  activeSuggestion[point] = (activeSuggestion[point] + step + count) % count;

  Array.from(document.getElementById(point + 'Results').children).forEach(function (item, i) {
    item.classList.toggle('active', i === activeSuggestion[point]);
  });
}


function usePlace(point, place) {

  document.getElementById(point + 'Search').value = placeLabel(place);

  stopSuggesting(point);
  closeSuggestions(point);

  // GeoJSON order: longitude first
  setPoint(point, place.geometry.coordinates[1], place.geometry.coordinates[0]);
}


function setPoint(point, lat, lng) {
  document.getElementById(point + 'Lat').value = lat.toFixed(5);
  document.getElementById(point + 'Lng').value = lng.toFixed(5);
  updateMap();
}

['origin', 'dest'].forEach(function (point) {

  const input = document.getElementById(point + 'Search');

  input.addEventListener('input', function () {
    suggestStreets(point);
  });

  input.addEventListener('blur', function () {
    stopSuggesting(point);
    closeSuggestions(point);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSuggestion(point, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSuggestion(point, -1);
    } else if (e.key === 'Escape') {
      closeSuggestions(point);
    } else if (e.key === 'Enter') {
      // Enter picks a suggestion here, it must not submit the order
      e.preventDefault();
      if (suggestions[point].length > 0) {
        usePlace(point, suggestions[point][Math.max(activeSuggestion[point], 0)]);
      }
    }
  });
});


// is this point somewhere a courier can get to? The map tiles paint all water, rivers
// and sea, in one colour, so the tile at this exact point tells us if it is in the water.
function isWater(lat, lng) {

  const zoom = 17;
  const size = Math.pow(2, zoom);
  const rad = lat * Math.PI / 180;
  const x = (lng + 180) / 360 * size;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * size;

  return new Promise(function (resolve, reject) {

    const tile = new Image();

    tile.crossOrigin = 'anonymous';
    tile.onerror = reject;
    tile.onload = function () {

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(tile, 0, 0);

      const px = Math.floor((x % 1) * 256);
      const py = Math.floor((y % 1) * 256);

      // the point and 4 around it, so a map label over the water doesn't hide it
      const samples = [[0, 0], [-4, 0], [4, 0], [0, -4], [0, 4]];
      const water = samples.filter(function (s) {
        const c = ctx.getImageData(px + s[0], py + s[1], 1, 1).data;
        return Math.abs(c[0] - 170) < 4 && Math.abs(c[1] - 211) < 4 && Math.abs(c[2] - 223) < 4;
      });

      resolve(water.length >= 3);
    };

    tile.src = 'https://tile.openstreetmap.org/' + zoom + '/' + Math.floor(x) + '/' + Math.floor(y) + '.png';
  });
}


function distanceToRoad(lat, lng) {
  return fetch('https://router.project-osrm.org/nearest/v1/driving/' + lng + ',' + lat)
    .then(function (r) {
      return r.ok ? r.json() : Promise.reject(r.status);
    })
    .then(function (data) {
      return data.waypoints[0].distance;
    });
}


// answers [is it in the water, metres to the nearest road], and doesn't ask twice.
// if a service doesn't answer we can't tell, so that check doesn't block the order
function pointCheck(lat, lng) {

  const key = lat + ',' + lng;

  if (!deliveryCache[key]) {
    deliveryCache[key] = Promise.all([
      isWater(lat, lng).catch(function () { return false; }),
      distanceToRoad(lat, lng).catch(function () { return 0; })
    ]);
  }

  return deliveryCache[key];
}


function streetLabel(data) {

  if (!data.address) return '';

  const a = data.address;
  const street = a.road || a.pedestrian || a.footway || a.path;
  const area = a.suburb || a.city || a.town || a.village;

  if (!street) return data.display_name.split(', ').slice(0, 2).join(', ');

  return area ? street + ', ' + area : street;
}


function showStreet(point, lat, lng) {

  const el = document.getElementById(point + 'Street');
  const input = document.getElementById(point + 'Search');
  const key = lat + ',' + lng;

  if (streetKeys[point] === key) return;

  streetKeys[point] = key;
  el.textContent = 'Looking up street…';
  document.getElementById(point + 'Results').replaceChildren();

  lookupStreet(lat, lng).then(function (street) {
    if (streetKeys[point] !== key) return;
    el.textContent = street || 'No street here';

    // keep the search box in step with the coordinates, unless the user is typing in it
    if (street && document.activeElement !== input) input.value = street;
  }).catch(function () {
    if (streetKeys[point] !== key) return;
    streetKeys[point] = '';
    el.textContent = 'Street name unavailable';
  });
}


function setPicking(point) {

  picking = point;

  document.querySelectorAll('.pick-btn').forEach(function (btn) {
    const on = btn.dataset.point === point;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

document.querySelectorAll('.pick-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    setPicking(btn.dataset.point);
  });
});

map.on('click', function (e) {

  const clicked = e.latlng.wrap();

  setPoint(picking, clicked.lat, clicked.lng);

  // after the origin, the natural next step is the destination
  if (picking === 'origin') setPicking('dest');
});


const coordInputs = ['originLat', 'originLng', 'destLat', 'destLng'];

coordInputs.forEach(function (id) {
  document.getElementById(id).addEventListener('change', function () {
    updateMap();
  });
});


document.getElementById('orderForm').addEventListener('submit', function (e) {

  e.preventDefault();

  const products = readProducts();
  const msg = document.getElementById('orderMsg');

  const c = getCoords();

  if (!coordsOk(c)) {
    msg.textContent = 'Invalid GPS coordinates.';
    msg.className = 'msg error';
    return;
  }

  for (let i = 0; i < products.length; i++) {

    const product = products[i];
    const name = products.length > 1 ? 'Product ' + (i + 1) + ': ' : '';
    const empty = productFields.find(function (field) {
      return product[field] === '';
    });

    if (empty) {
      msg.textContent = name + 'Please complete all required fields.';
      msg.className = 'msg error';
      const block = document.querySelectorAll('.product')[i];
      const select = block.querySelector('[data-field="category"]');

      if (empty === 'category' && select.value === 'Other') {
        block.querySelector('.category-other').focus();
      } else {
        block.querySelector('[data-field="' + empty + '"]').focus();
      }
      return;
    }

    if (!(Number(product.weight) > 0) || !(Number(product.volume) > 0)) {
      msg.textContent = name + 'Weight and volume must be greater than zero.';
      msg.className = 'msg error';
      return;
    }
  }

  const button = this.querySelector('button[type="submit"]');

  updateMap();

  button.disabled = true;
  msg.textContent = 'Checking the addresses…';
  msg.className = 'msg';

  deliveryCheck.then(function (problem) {

    button.disabled = false;

    if (problem) {
      msg.textContent = problem;
      msg.className = 'msg error';
      return;
    }

    // not logged in: keep the order and send it when the login brings the user back
    if (!loggedIn) {
      const draft = {};

      draftFields.forEach(function (id) {
        draft[id] = document.getElementById(id).value;
      });

      draft.products = products;

      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      window.location.href = 'login.html?role=client&from=order';
      return;
    }

    const order = {
      // the courier's sample list goes up to #2045
      id: Math.max.apply(null, [2045].concat(savedOrders().map(function (o) { return o.id; }))) + 1,
      email: sessionStorage.getItem('cmsEmail'),
      origin: [c.originLat, c.originLng],
      dest: [c.destLat, c.destLng],
      originName: '',
      destName: '',
      products: products.map(function (product) {
        return product.category + ': ' + product.description;
      }).join('; '),
      status: 'Initiated'
    };

    cmsWrite(ORDERS_KEY, savedOrders().concat(order));
    addOrderRow(order);

    msg.textContent = 'Order added correctly.';
    msg.className = 'msg success';
  });
});


function savedOrders() {
  return cmsRead(ORDERS_KEY, []);
}


function addOrderRow(order) {

  const row = document.getElementById('ordersBody').insertRow(0);

  row.insertCell(0).textContent = '#' + order.id;
  fillPlace(row.insertCell(1), order, 'origin');
  fillPlace(row.insertCell(2), order, 'dest');
  row.insertCell(3).textContent = order.products;
  row.insertCell(4).textContent = 'Pending';

  const status = document.createElement('span');

  status.className = 'status status-initiated';
  status.textContent = order.status;
  row.insertCell(5).appendChild(status);
}


// coordinates at first, replaced by the street name when the lookup answers
function fillPlace(cell, order, point) {

  const lat = order[point][0];
  const lng = order[point][1];

  cell.textContent = order[point + 'Name'] || lat.toFixed(4) + ', ' + lng.toFixed(4);

  if (order[point + 'Name']) return;

  lookupStreet(lat, lng).then(function (street) {

    if (!street) return;

    cell.textContent = street;

    cmsWrite(ORDERS_KEY, savedOrders().map(function (saved) {
      if (saved.id === order.id) saved[point + 'Name'] = street;
      return saved;
    }));
  }).catch(function () {
    // keep the coordinates
  });
}


// an order has one or more products, each one is a block made from the template
function addProduct(values) {

  const block = document.getElementById('productTemplate').content.cloneNode(true).firstElementChild;

  productCount++;

  // each input needs its own id, for its label
  block.querySelectorAll('[data-field]').forEach(function (input) {
    input.id = input.dataset.field + productCount;
    input.parentElement.querySelector('label').htmlFor = input.id;
    if (values) input.value = values[input.dataset.field];
  });

  const category = block.querySelector('[data-field="category"]');
  const other = block.querySelector('.category-other');

  category.addEventListener('change', function () {
    other.hidden = category.value !== 'Other';
    if (!other.hidden) other.focus();
  });

  // a saved category that isn't in the list was written under Other
  if (values && values.category && category.value !== values.category) {
    category.value = 'Other';
    other.value = values.category;
    other.hidden = false;
  }

  block.querySelector('.product-remove').addEventListener('click', function () {
    block.remove();
    updateProducts();
  });

  document.getElementById('productList').appendChild(block);
  updateProducts();

  return block;
}


function readProducts() {
  return Array.from(document.querySelectorAll('.product')).map(function (block) {
    const product = {};

    productFields.forEach(function (field) {
      product[field] = block.querySelector('[data-field="' + field + '"]').value.trim();
    });

    if (product.category === 'Other') {
      product.category = block.querySelector('.category-other').value.trim();
    }

    return product;
  });
}


function updateProducts() {

  const blocks = document.querySelectorAll('.product');

  blocks.forEach(function (block, i) {
    block.querySelector('.product-title').textContent = 'Product ' + (i + 1);
    // an order needs at least one product
    block.querySelector('.product-remove').hidden = blocks.length === 1;
  });

  let weight = 0;
  let volume = 0;

  readProducts().forEach(function (product) {
    weight += Number(product.weight) || 0;
    volume += Number(product.volume) || 0;
  });

  document.getElementById('productTotal').textContent =
    'Total: ' + weight.toFixed(2) + ' kg · ' + volume.toFixed(3) + ' m³';
}

document.getElementById('productList').addEventListener('input', updateProducts);

document.getElementById('addProduct').addEventListener('click', function () {
  addProduct().querySelector('[data-field="description"]').focus();
});


// this client's earlier orders
if (loggedIn) {
  savedOrders().filter(function (order) {
    return order.email === sessionStorage.getItem('cmsEmail');
  }).forEach(addOrderRow);
}


// an order waiting for the login: put it back in the form, and send it once logged in
const savedDraft = JSON.parse(sessionStorage.getItem(DRAFT_KEY));

if (savedDraft) {
  draftFields.forEach(function (id) {
    document.getElementById(id).value = savedDraft[id];
  });

  savedDraft.products.forEach(addProduct);
} else {
  addProduct();
}

updateMap();

if (savedDraft && loggedIn) {
  sessionStorage.removeItem(DRAFT_KEY);
  document.getElementById('orderForm').requestSubmit();
}
