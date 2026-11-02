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
let orderNumber = 2042;


function getCoords() {
  return {
    originLat: Number(document.getElementById('originLat').value),
    originLng: Number(document.getElementById('originLng').value),
    destLat: Number(document.getElementById('destLat').value),
    destLng: Number(document.getElementById('destLng').value)
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
    return;
  }

  const origin = [c.originLat, c.originLng];
  const destination = [c.destLat, c.destLng];

  if (originMarker) map.removeLayer(originMarker);
  if (destinationMarker) map.removeLayer(destinationMarker);
  if (line) map.removeLayer(line);

  originMarker = L.marker(origin).addTo(map);
  destinationMarker = L.marker(destination).addTo(map);

  originMarker.bindPopup('Origin');
  destinationMarker.bindPopup('Destination');

  // simple line for the sprint 1 prototype
  line = L.polyline([origin, destination], {
    color: '#2f5d9e',
    weight: 5
  }).addTo(map);

  map.fitBounds([origin, destination], {
    padding: [40, 40]
  });

  document.getElementById('originText').textContent =
    c.originLat.toFixed(4) + ', ' + c.originLng.toFixed(4);

  document.getElementById('destText').textContent =
    c.destLat.toFixed(4) + ', ' + c.destLng.toFixed(4);
}


const coordInputs = ['originLat', 'originLng', 'destLat', 'destLng'];

coordInputs.forEach(function (id) {
  document.getElementById(id).addEventListener('change', function () {
    updateMap();
  });
});


document.getElementById('orderForm').addEventListener('submit', function (e) {

  e.preventDefault();

  const description = document.getElementById('description').value.trim();
  const category = document.getElementById('category').value.trim();
  const weight = Number(document.getElementById('weight').value);
  const volume = Number(document.getElementById('volume').value);
  const msg = document.getElementById('orderMsg');

  const c = getCoords();

  if (description === '' || category === '' ||
      isNaN(weight) || isNaN(volume)) {

    msg.textContent = 'Please complete all required fields.';
    msg.className = 'msg error';
    return;
  }

  if (!coordsOk(c)) {
    msg.textContent = 'Invalid GPS coordinates.';
    msg.className = 'msg error';
    return;
  }

  if (weight <= 0 || volume <= 0) {
    msg.textContent = 'Weight and volume must be greater than zero.';
    msg.className = 'msg error';
    return;
  }

  updateMap();

  orderNumber++;

  // add the new order to the status table
  const table = document.getElementById('ordersBody');
  const row = table.insertRow(0);

  row.insertCell(0).textContent = '#' + orderNumber;
  row.insertCell(1).textContent =
    c.originLat.toFixed(4) + ', ' + c.originLng.toFixed(4);
  row.insertCell(2).textContent =
    c.destLat.toFixed(4) + ', ' + c.destLng.toFixed(4);
  row.insertCell(3).textContent = category + ': ' + description;
  row.insertCell(4).textContent = 'Pending';

  const statusCell = row.insertCell(5);
  const status = document.createElement('span');

  status.className = 'status status-initiated';
  status.textContent = 'Initiated';

  statusCell.appendChild(status);

  msg.textContent = 'Order added correctly.';
  msg.className = 'msg success';
});


updateMap();
