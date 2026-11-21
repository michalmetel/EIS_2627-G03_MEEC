<?php
// Run from the repo folder:  php tests/pricing_test.php
// Checks the example from the Sprint 2 spec (section 5.2): must give 9.70 €.
require_once __DIR__ . '/../Project/app/BLL/PricingService.php';

$rates  = ['fee_base' => 2.50, 'rate_km' => 0.40, 'rate_kg' => 0.30];
$result = PricingService::calculate(15.0, 3.0, 0.02, $rates);

print_r($result);
echo $result['total'] == 9.70 ? "OK: 9.70\n" : "WRONG: expected 9.70\n";
