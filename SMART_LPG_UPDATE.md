# CounterPOS LPG & Smart Android UI update

Deploy the `CounterPOS-main` server and web folders using your existing Render services and MongoDB. Keep environment variables in Render; no credentials are included. The backend public URL was not supplied, so configure the existing Android server URL field with the actual backend URL ending in /api. Do not use the static frontend URL unless it actually proxies API requests.

LPG: add one stock record with company, size, gas price and bottle price. Refill is the default cart mode and the matching empty cylinder is selected automatically; choose another active stock record using the return dropdown. Return quantity tracks refill quantity. Package charges gas plus bottle and returns no empties. Sale payload uses explicit mode and return ID with existing server transactional checkout. The server remains authoritative for stock and price validation. Taxes and configured charges still apply.

Existing records are retained. Edit legacy records to enter both prices before selling packages; legacy refill price can be used as gas price. Legacy package-only records need a gas price before checkout. Do not automatically merge duplicate stock records; review and reconcile stock manually. New demo seed records include illustrative split prices; do not reset live inventory.

Android UI updates: shared color and button styling, ripple feedback, tappable home menu cards, fixed home quick navigation, inventory search, more compact catalog spacing, persistent discount when switching payment, mode buttons and returned-cylinder dropdown. Existing screens and business workflows retained; this is not a complete rewrite of each screen.

Validation: backend JavaScript syntax check and TypeScript transpilation syntax checks passed. Full web dependency installation unavailable in local cache; Android SDK/Gradle unavailable, so no full builds or live checkout tests. Before production test refill, alternative return, package, multi-quantity, stockout, discount, taxes, receipt and due sales on a staging database. Subscription logic is unchanged in this update; previous security/trial inconsistencies remain outside this LPG/UI scope.
