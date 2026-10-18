# Nationwide project sales tax

The Pricing page supports all 50 states and D.C. Enable **Include sales tax** and enter the project delivery street, city, state and ZIP. Completion or editing of the address triggers a debounced server lookup. The jurisdiction breakdown scrolls independently. Tax is added to the customer total, not purchase cost, gross profit or margin. Supplier purchase documents remain purchase-only; their customer destination rate metadata is explicitly labeled.

This is a standard taxable tangible-goods **quote estimate**, not a determination of nexus, exemption eligibility, installation/construction-contract treatment, origin sourcing or product-specific taxability. City/ZIP alone cannot guarantee jurisdiction precision. TaxJar groups special districts; Avalara returns its individual rate components.

## Activation

Configure one provider in `/etc/vulpine-operations/runtime.env`, using the existing protected server secret mechanism:

- `TAXJAR_API_TOKEN` for TaxJar production rates API; or
- `AVALARA_ACCOUNT_ID` and `AVALARA_LICENSE_KEY` for Avalara production TaxRatesByAddress.

TaxJar takes precedence if both are configured. No credentials go into browser code, Git or quotes. Restart `vulpine-cabinet-pricing.service` after configuration. A provider account/subscription with the relevant API entitlement is required. No subscription is purchased by this implementation.

The existing signed, same-origin `POST /export` proxy accepts `{format:"tax-rate",address:{street,city,state,zip}}` for rate lookup. No new backoffice proxy deployment or authorization relaxation is needed. Direct service routes `/tax/status` and `/tax/lookup` also require the existing signed authentication.

Snapshots are HMAC-signed with the existing operations signing secret, address-bound and expire after 24 hours. Export rejects missing, changed, expired or unsigned tax snapshots. No provider/failure is **unavailable**, never a zero rate. Existing drafts default to tax off; no historical prices are silently changed. Tax-enabled saved agent bids retain the same snapshot and checks.

Provider documentation:
- https://developers.taxjar.com/api/reference/#get-show-tax-rates-for-a-location
- https://developer.avalara.com/api-reference/avatax/rest/v2/methods/TaxContent/TaxRatesByAddress/

The automated provider tests use synthetic rates and do not establish live provider availability. After configuring a provider, validate known delivery addresses in several states, multi-district locations and a zero-sales-tax location against the provider before using customer totals.

## Customer-ready proposals (pricing policy 2)

A rate lookup alone cannot establish transaction taxability. The TaxJar
`POST /v2/taxes` adapter submits cabinet/materials, decorative handles,
installation/assembly when priced, and freight separately. Its signed response
binds delivery address, applicable date, exact line amounts, taxable amounts,
freight taxability and collected tax. Changing any amount/date requires refresh.
See the provider's [API reference](https://developers.taxjar.com/api/reference/)
and [calculation guide](https://developers.taxjar.com/integrations/sales-tax-calculations/).
Avalara address-rate lookup remains available for historical rate snapshots;
it does not satisfy the current transaction gate.

Missing credentials, address data, stale results or an incomplete breakdown
leave the draft with tax/total pending. No unknown rate becomes zero. An
applicable exemption requires its reason, authority, evidence reference,
effective dates, matching delivery address, and a server signature obtained
through the authenticated app. Exemption evidence is not invented automatically.
