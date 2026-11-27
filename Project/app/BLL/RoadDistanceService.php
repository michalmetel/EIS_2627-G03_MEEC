<?php
// BLL: real driving distances from the public OSRM server (OpenStreetMap routing).
// Uses the OSRM "table" service: ONE request returns the road distance from every
// courier to the pickup point. If OSRM is slow or down, returns null and the
// caller keeps the straight-line distance, so dispatch never stops working.
class RoadDistanceService
{
    const OSRM_URL = 'https://router.project-osrm.org/table/v1/driving/';
    const TIMEOUT_SECONDS = 3;

    // $from: list of ['lat' => .., 'lng' => ..] (the couriers)
    // $to:   ['lat' => .., 'lng' => ..]          (the pickup)
    // Returns road distance in km for each $from point (same order), or null on failure.
    public static function kmToPoint(array $from, array $to): ?array
    {
        if (count($from) === 0) {
            return [];
        }

        // OSRM wants "lng,lat" pairs separated by ";". Point 0 = pickup, 1..n = couriers.
        $points = [sprintf('%F,%F', $to['lng'], $to['lat'])];
        foreach ($from as $p) {
            $points[] = sprintf('%F,%F', $p['lng'], $p['lat']);
        }
        $sources = implode(';', range(1, count($from)));
        $url = self::OSRM_URL . implode(';', $points)
             . '?sources=' . $sources . '&destinations=0&annotations=distance';

        $context = stream_context_create(['http' => [
            'timeout'       => self::TIMEOUT_SECONDS,
            'ignore_errors' => true,
            'header'        => "User-Agent: CMS-student-project/1.0\r\n", // OSRM refuses requests without one
        ]]);

        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            return null; // no internet / timeout
        }
        $data = json_decode($body, true);
        if (!is_array($data) || ($data['code'] ?? '') !== 'Ok' || !isset($data['distances'])) {
            return null; // OSRM error or rate limit
        }

        $km = [];
        foreach ($data['distances'] as $row) {
            // null = OSRM found no road between the points
            $km[] = $row[0] === null ? null : $row[0] / 1000;
        }
        return $km;
    }
}
