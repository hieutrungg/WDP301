# PROMO-101 database rollout (PowerShell)

Runtime does not create collections, indexes or validators. The owner-approved schema is implemented by `server/src/migrations/20261027-promo101.js`. Default operation is **read-only inspection**, including actual data, validator/index definitions and replica-set support. No migration, seed or backfill was applied to development Atlas by this task.

## Inspection performed

On 2026-10-27, ran the script in INSPECT_ONLY mode against the explicitly selected `cinema_management_dev`. Result: no incompatible existing Promotion/Voucher data reported; four collection validators and five required indexes missing. This is a point-in-time check, not an assertion that the database will remain unchanged before application.

## 1. Inspect and save the result

Use the existing server `.env` connection. Do not paste credentials into commands, screenshots or this document.

```powershell
Set-Location 'D:\FPT\semester8\WDP\project\server'
$promoDatabase = 'cinema_management_dev'
node src/migrations/20261027-promo101.js --database $promoDatabase |
  Tee-Object -FilePath promo101-inspection.json
```

Confirm the printed `database` is the intended target and `mode` is `INSPECT_ONLY`. `errors` must be empty. `missing` lists required rollout work, not data to delete. The script refuses unsupported deployment topology. It reports incompatible records, normalized-code duplicates, missing parent links, inconsistent counters/redemption history, malformed redemption links/states and duplicate unique-key claims; it never fixes them. Resolve such findings with the data owner before continuing.

## 2. Owner applies explicitly

Pause Promotion/Voucher writers during DDL and keep the inspection result for review. Exact database confirmation is required; remote application also needs `--allow-remote`.

```powershell
node src/migrations/20261027-promo101.js `
  --database $promoDatabase `
  --apply `
  --confirm-database $promoDatabase `
  --allow-remote
```

For a local MongoDB replica set omit `--allow-remote`. Production requires the deployment owner's separate workflow; this script refuses `NODE_ENV=production`.

Apply rechecks data and index compatibility before any DDL. It creates missing Promotion-owned collections, installs strict error validators and creates required indexes. Equivalent safe indexes are reused even if their names differ. Conflicting indexes stop application; none are dropped. Unexpected infrastructure errors can interrupt DDL after a partial installation; rerun inspection and resolve the exact failure. The script is repeatable and does not update/delete business records.

## 3. Verify

```powershell
node src/migrations/20261027-promo101.js --database $promoDatabase |
  Tee-Object -FilePath promo101-verification.json
```

Expected: `errors: []` and `missing: []`. Restart the server if it was not already running the new code. Sign in as Manager, open `/manager/promotions`, create a campaign and code intentionally, then verify a Customer checkout. Do not seed demonstration data into development automatically.

## Changes installed

- Existing `promotions` / `vouchers` remain the catalog. Percentage-only policy, campaign version/audit metadata, nullable unlimited quota, reserved/used counters and inherited validity.
- New `voucher_redemptions` stores immutable reservation history. Unique partial indexes enforce one blocking claim per Customer/code and one applied code per Booking. CONSUMED claims remain blocking after refund.
- New `voucher_commands` gives unique Booking/request-key replay evidence. No TTL deletion of redemption or command history.
- Additive Booking fields: voucherId, voucherSnapshot, pricingVersion and pricingLockedAt. Payment gains pricingVersion. Old undiscounted records remain readable without backfill; the script does not rewrite their amount or timestamps. Actual development Booking/Payment validator metadata was inspected read-only and permits these additive fields; the migration owns only Promotion collection validators.
- Runtime validates required validator/index options before voucher operations. `503 VOUCHER_STORAGE_NOT_READY` is expected until rollout is complete. Ordinary ticket checkout has no Promotion storage dependency.

## Test isolation

Automated tests and browser fixtures use uniquely named `promo101_test_<pid>_<epoch-seconds>_<random>` databases. Names stay within the Atlas tier's length limit. Cleanup requires exact database identity and the test-name pattern before dropping only that disposable database. No test chooses `cinema_management_dev` as its target. Inspection above is read-only; DDL and sample UI data were written only in isolated test databases.
