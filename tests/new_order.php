<?php
// DEV TOOL (WP3 testing) – creates a PAID order ('pending') so the dispatch queue offers it to a courier.
// Works only while 'debug' is true. Delete before submission, like dev-login.php.
//
//   http://localhost:8000/tests/new_order.php                      random pickup and drop-off
//   http://localhost:8000/tests/new_order.php?from=maia&to=feup    chosen places
//   http://localhost:8000/tests/new_order.php?product=6            heavier load (see PRODUCT ids in cms.sql)
//
// This simulates what the client page + WP1 (payment) will do for real, so the SQL
// lives here on purpose and not in a repository.
require_once __DIR__ . '/../Project/app/bootstrap.php';

if (!$config['debug']) {
    Response::error('Only available in debug mode', 403);
}

$places = [
    'feup'       => [41.1780, -8.5980],
    'trindade'   => [41.1521, -8.6097],
    'aliados'    => [41.1496, -8.6110],
    'boavista'   => [41.1579, -8.6291],
    'casamusica' => [41.1588, -8.6307],
    'ribeira'    => [41.1407, -8.6131],
    'gaia'       => [41.1239, -8.6118],
    'matosinhos' => [41.1821, -8.6891],
    'maia'       => [41.2357, -8.6199],
];

$names = array_keys($places);
$from  = $_GET['from'] ?? $names[array_rand($names)];
$to    = $_GET['to']   ?? null;
if (!isset($places[$from])) {
    Response::error('Unknown place. Use one of: ' . implode(', ', $names), 400);
}
if ($to === null) {
    do { $to = $names[array_rand($names)]; } while ($to === $from);
}
if (!isset($places[$to]) || $to === $from) {
    Response::error('Invalid destination. Use one of: ' . implode(', ', $names), 400);
}

$db = Database::get();

$productId = (int) ($_GET['product'] ?? 2); // 2 = laptop (3 kg)
$stmt = $db->prepare('SELECT client_id, weight_kg, volume_m3 FROM PRODUCT WHERE product_id = ?');
$stmt->execute([$productId]);
$product = $stmt->fetch();
if (!$product) {
    Response::error('Unknown product id', 400);
}

[$oLat, $oLng] = $places[$from];
[$dLat, $dLng] = $places[$to];
$km    = round(DispatchService::distanceKm($oLat, $oLng, $dLat, $dLng) * 1.3, 2); // ~road distance
$price = PricingService::calculate($km, (float) $product['weight_kg'], (float) $product['volume_m3'])['total'];

$db->prepare(
    "INSERT INTO `ORDER` (client_id, origin_lat, origin_long, dest_lat, dest_long, status, distance_km, price)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)"
)->execute([$product['client_id'], $oLat, $oLng, $dLat, $dLng, $km, $price]);
$orderId = (int) $db->lastInsertId();

$db->prepare('INSERT INTO ORDER_ITEM (order_id, product_id, quantity) VALUES (?, ?, 1)')
   ->execute([$orderId, $productId]);

// what WP1 will do after a successful payment: start the dispatch right away
DispatchService::run();

$stmt = $db->prepare(
    'SELECT d.courier_id, u.name FROM DISPATCH_OFFER d JOIN `USER` u ON u.user_id = d.courier_id
      WHERE d.order_id = ? AND d.response IS NULL'
);
$stmt->execute([$orderId]);
$offer = $stmt->fetch();

Response::ok([
    'order_id'   => $orderId,
    'from'       => $from,
    'to'         => $to,
    'price'      => $price,
    'offered_to' => $offer ? $offer['name'] . ' (user ' . $offer['courier_id'] . ')'
                           : 'nobody yet (every courier is busy with an offer or already declined)',
]);
