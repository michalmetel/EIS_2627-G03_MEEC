<?php
// DAL: the ONLY place with SQL for the PRICING_SETTINGS table (always one row, pricing_id = 1).
class PricingRepository
{
    public static function get(): array
    {
        $stmt = Database::get()->query('SELECT fee_base, rate_km, rate_kg FROM PRICING_SETTINGS WHERE pricing_id = 1');
        return $stmt->fetch();
    }
}
