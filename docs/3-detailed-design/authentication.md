# Authentication Class Design

## Scope and Business Flow

Supports registration, email OTP verification, login, password reset, and logout/token revocation. Registration creates a pending account and a short-lived single-use verification token; login requires verified active status.

## Current Design Review

- Keep the Account and VerificationToken concepts, controller boundary, repository abstractions, and notification integration.
- Remove `ServiceImpl` and `JpaRepository` from the design; they expose implementation mechanics and contradict Mongoose.
- Split the broad `AuthService` into explicit use cases so registration, authentication, verification, and password reset do not share one growing class.
- Move password hashing, token issuing/revocation, clock, and notification behind ports.
- Do not let `Account` hash passwords itself; it may verify status and accept an already-hashed credential through controlled behavior.

## Proposed Responsibilities and Relationships

`Account` is the aggregate root for credentials and status. `EmailVerificationToken` is composed by its lifecycle owner and references one account. Controllers translate HTTP only. Use cases depend on repository and technical ports. Token expiry and single-use rules are enforced by domain behavior using an injected clock. Account email/username uniqueness must be protected by MongoDB unique indexes in addition to application checks.

## Key Changes

| Current | Decision | Proposed |
| --- | --- | --- |
| `AuthServiceImpl` | Split | `RegisterAccount`, `AuthenticateAccount`, `VerifyEmail`, `ResetPassword` |
| `RoleRepository` in login | Move | `AuthorizationQueryPort` returns effective authorities |
| `Account.checkPassword` | Move | `PasswordHasher.verify` port |
| session/token ambiguity | Clarify | `AccessTokenIssuer` plus optional `SessionRevocationPort` |

Assumption: email verification is required before normal login.

Open Design Question: decide whether logout revokes a stored refresh token/session or only removes a client-side access token.

