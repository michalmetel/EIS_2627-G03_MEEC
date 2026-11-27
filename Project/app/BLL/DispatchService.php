<?php
// BLL: WP3 – Dynamic Dispatch Queue & Proximity Allocation.
//
// How it works:
//  1. A paid order is 'pending'.
//  2. run() offers it to the NEAREST eligible courier (distance from the courier's
//     last drop-off to the order's pickup point). The offer lasts OFFER_SECONDS.
//  3. The courier accepts -> order is assigned (route created, status 'initiated').
//     The courier declines or lets it expire -> run() offers it to the next nearest courier.
//  4. If every courier was already tried, the order waits; after RETRY_MINUTES
//     the couriers who said no can get it again.
//
// PHP does not run in the background, so run() is called every time a courier
// asks for offers (the courier page polls every few seconds). WP1 can also call
// DispatchService::run() right after a payment succeeds.
class DispatchService
{
    const OFFER_SECONDS = 60;
    const RETRY_MINUTES = 5;
    const SHORTLIST     = 5; // how many of the nearest couriers are compared by road distance

    // Courier with no completed delivery yet starts at FEUP.
    const DEFAULT_LAT = 41.1780;
    const DEFAULT_LNG = -8.5980;

    const EARTH_RADIUS_KM = 6371;

    // Expire old offers, then send a new offer for every order without one.
    public static function run(): void
    {
        DispatchRepository::expireOverdueOffers();

        foreach (DispatchRepository::ordersWaitingForCourier() as $order) {
            $orderId = (int) $order['order_id'];
            $load    = DispatchRepository::orderLoad($orderId);

            $nearest = self::nearestCourier(
                $orderId,
                (float) $order['origin_lat'],
                (float) $order['origin_long'],
                (float) $load['weight_kg'],
                (float) $load['volume_m3']
            );

            if ($nearest !== null) {
                DispatchRepository::createOffer($orderId, $nearest, self::OFFER_SECONDS);
            }
            // No courier available: the order stays 'pending' and is tried again on the next run().
        }
    }

    // Returns the user_id of the closest eligible courier, or null.
    // Step 1: straight-line distance for every eligible courier (fast, no internet).
    // Step 2: the SHORTLIST closest ones are compared by real road distance (OSRM).
    //         If OSRM fails, the straight-line winner is used.
    public static function nearestCourier(int $orderId, float $pickupLat, float $pickupLng, float $weightKg, float $volumeM3): ?int
    {
        $couriers = DispatchRepository::eligibleCouriers($orderId, $weightKg, $volumeM3, self::RETRY_MINUTES);
        if (count($couriers) === 0) {
            return null;
        }

        // Step 1
        $candidates = [];
        foreach ($couriers as $c) {
            $loc = self::courierLocation((int) $c['user_id']);
            $candidates[] = [
                'id'  => (int) $c['user_id'],
                'loc' => $loc,
                'km'  => self::distanceKm($loc['lat'], $loc['lng'], $pickupLat, $pickupLng),
            ];
        }
        usort($candidates, fn($a, $b) => $a['km'] <=> $b['km']);
        $shortlist = array_slice($candidates, 0, self::SHORTLIST);

        // Step 2
        $roadKm = RoadDistanceService::kmToPoint(
            array_column($shortlist, 'loc'),
            ['lat' => $pickupLat, 'lng' => $pickupLng]
        );
        if ($roadKm === null) {
            return $shortlist[0]['id']; // OSRM unavailable: straight line decides
        }

        $bestId   = $shortlist[0]['id'];
        $bestDist = INF;
        foreach ($shortlist as $i => $c) {
            if ($roadKm[$i] !== null && $roadKm[$i] < $bestDist) {
                $bestDist = $roadKm[$i];
                $bestId   = $c['id'];
            }
        }
        return $bestId;
    }

    // Last drop-off, or FEUP if the courier has no deliveries yet.
    public static function courierLocation(int $courierId): array
    {
        $last = DispatchRepository::lastDropOff($courierId);
        if ($last === null) {
            return ['lat' => self::DEFAULT_LAT, 'lng' => self::DEFAULT_LNG, 'is_default' => true];
        }
        return ['lat' => (float) $last['lat'], 'lng' => (float) $last['lng'], 'is_default' => false];
    }

    // Straight-line distance between two GPS points (Haversine formula).
    public static function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return self::EARTH_RADIUS_KM * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    // The offer the courier must answer now, ready for the page (or null).
    public static function currentOffer(int $courierId): ?array
    {
        self::run();

        $offer = DispatchRepository::openOfferForCourier($courierId);
        if ($offer === null) {
            return null;
        }

        $orderId = (int) $offer['order_id'];
        $load    = DispatchRepository::orderLoad($orderId);
        $here    = self::courierLocation($courierId);
        $pickup  = ['lat' => (float) $offer['origin_lat'], 'lng' => (float) $offer['origin_long']];

        return [
            'offer_id'        => (int) $offer['offer_id'],
            'order_id'        => $orderId,
            'seconds_left'    => (int) $offer['seconds_left'],
            'offer_seconds'   => self::OFFER_SECONDS,
            'price'           => (float) $offer['price'],
            'trip_km'         => (float) $offer['distance_km'],
            'to_pickup_km'    => round(self::distanceKm($here['lat'], $here['lng'], $pickup['lat'], $pickup['lng']), 1),
            'weight_kg'       => round((float) $load['weight_kg'], 2),
            'volume_m3'       => round((float) $load['volume_m3'], 3),
            'courier'         => $here,
            'pickup'          => $pickup,
            'dropoff'         => ['lat' => (float) $offer['dest_lat'], 'lng' => (float) $offer['dest_long']],
        ];
    }

    // Active order of the courier for the courier page (or null).
    public static function activeOrder(int $courierId): ?array
    {
        $o = DispatchRepository::activeOrderForCourier($courierId);
        if ($o === null) {
            return null;
        }
        $items = [];
        foreach (DispatchRepository::orderItems((int) $o['order_id']) as $it) {
            $qty = (int) $it['quantity'];
            $items[] = [
                'desc' => ($qty > 1 ? $qty . '× ' : '') . $it['description'],
                'kg'   => (float) $it['weight_kg'] * $qty,
                'm3'   => (float) $it['volume_m3'] * $qty,
            ];
        }
        return [
            'order_id'   => (int) $o['order_id'],
            'status'     => $o['status'],
            'attempt'    => (int) $o['attempt'],
            'origin'     => [(float) $o['origin_lat'], (float) $o['origin_long']],
            'dest'       => [(float) $o['dest_lat'], (float) $o['dest_long']],
            'price'      => (float) $o['price'],
            'route_id'   => (int) $o['route_id'],
            'vehicle_id' => (int) $o['vehicle_id'],
            'products'   => $items,
        ];
    }

    public static function accept(int $courierId, int $offerId): array
    {
        $offer = self::openOfferOf($courierId, $offerId);
        $orderId = (int) $offer['order_id'];

        if (DispatchRepository::orderStatus($orderId) !== 'pending') {
            DispatchRepository::setResponse($offerId, 'expired');
            Response::error('This order is no longer available', 409);
        }

        $load = DispatchRepository::orderLoad($orderId);
        $vehicleId = DispatchRepository::bestVehicle($courierId, (float) $load['weight_kg'], (float) $load['volume_m3']);
        if ($vehicleId === null) {
            Response::error('None of your vehicles can carry this order', 409);
        }

        DispatchRepository::assignOrder($offerId, $orderId, $courierId, $vehicleId);
        return ['order_id' => $orderId, 'vehicle_id' => $vehicleId];
    }

    public static function decline(int $courierId, int $offerId): void
    {
        self::openOfferOf($courierId, $offerId);
        DispatchRepository::setResponse($offerId, 'declined');
        self::run(); // pass the order to the next nearest courier straight away
    }

    // The offer must exist, belong to this courier, be unanswered and not expired.
    private static function openOfferOf(int $courierId, int $offerId): array
    {
        $offer = DispatchRepository::findOffer($offerId);
        if ($offer === null || (int) $offer['courier_id'] !== $courierId) {
            Response::error('Offer not found', 404);
        }
        if ($offer['response'] !== null) {
            Response::error('This offer was already answered', 409);
        }
        if (!(int) $offer['still_valid']) {
            DispatchRepository::setResponse($offerId, 'expired');
            Response::error('This offer has expired', 409);
        }
        return $offer;
    }
}
