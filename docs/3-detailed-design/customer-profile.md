# Customer Profile Class Design

## Scope and Business Flow

Supports viewing and updating the signed-in user's profile, changing password, and querying transaction/booking history.

## Current Design Review

- Remove the duplicate `Customer` entity because the MongoDB design embeds customer profile fields in `accounts`.
- Keep `Account` as the profile aggregate, but separate profile changes from password changes.
- Remove `PaymentRepository` and `CustomerRepository` from one profile service. Transaction history is a read query across payments/bookings and should not mutate the profile aggregate.
- Replace generic `Object` returns with purpose-specific views and commands.

## Proposed Responsibilities and Relationships

`ProfileApplicationService` loads and changes the Account profile. `ChangePassword` owns credential verification and hashing. `CustomerHistoryQuery` uses a read-model port and returns immutable summaries. The API controller never combines or writes repository records itself.

## Key Changes

`CustomerProfileServiceImpl` is split into profile command, password command, and history query responsibilities. `Customer` is merged into `Account.Profile`. Payment records remain owned by Payment; the profile module sees only a stable projection.

Assumption: a customer profile is optional until completed, but every profile belongs to exactly one account.

