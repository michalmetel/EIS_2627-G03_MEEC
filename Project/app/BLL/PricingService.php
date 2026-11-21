<?php
// BLL: order price (Sprint 2 spec, section 5).
// Price = fee_base + distance_km * rate_km + max(weight_kg, volume_m3 * 200) * rate_kg
// The distance is NOT calculated here – it comes from the OSRM function (WP2).
class PricingService
{
    const VOLUMETRIC_FACTOR = 200; // 1 m³ counts as 200 kg

    // $rates is optional: if not given, the current rates are read from the database.
    public static function calculate(float $distanceKm, float $weightKg, float $volumeM3, ?array $rates = null): array
    {
        if ($rates === null) {
            $rates = PricingRepository::get();
        }
        $feeBase = (float) $rates['fee_base'];
        $rateKm  = (float) $rates['rate_km'];
        $rateKg  = (float) $rates['rate_kg'];

        $distanceCost = $distanceKm * $rateKm;
        $volumetricKg = $volumeM3 * self::VOLUMETRIC_FACTOR;
        $chargeableKg = max($weightKg, $volumetricKg);
        $weightCost   = $chargeableKg * $rateKg;
        $total        = $feeBase + $distanceCost + $weightCost;

        // Full breakdown, so the client and reports can show where the price comes from.
        return [
            'fee_base'      => round($feeBase, 2),
            'distance_km'   => round($distanceKm, 2),
            'distance_cost' => round($distanceCost, 2),
            'volumetric_kg' => round($volumetricKg, 2),
            'chargeable_kg' => round($chargeableKg, 2),
            'weight_cost'   => round($weightCost, 2),
            'total'         => round($total, 2),
        ];
    }
}
