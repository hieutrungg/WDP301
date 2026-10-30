# Internal sign-in implementation

Implemented 2026-10-29 from the owner instruction to provide a cinema-specific Staff entry point.

- The public sign-in screen keeps Customer sign-in unchanged and adds `Internal Sign In` for Staff and Managers.
- Staff select an ACTIVE cinema and submit their Staff credentials to `POST /api/auth/internal-login`.
- The internal form mirrors the Customer login controls and also supports Google through `POST /api/auth/internal-google`; Google never creates an internal account and only accepts an existing Staff or Manager email assigned to the selected cinema.
- The backend authenticates the password, requires the `STAFF` or `MANAGER` role, requires the account's `employeeProfile.branchId` to match the selected cinema, and refuses an inactive cinema before issuing the existing HTTP-only access cookie.
- The normal `POST /api/auth/login` contract is unchanged.
- Development seed creates one deterministic Staff account per branch. Accounts for inactive branches are seeded `DISABLED`. The seed is idempotent and does not overwrite an existing seeded account password.

Development-only credentials use usernames `staff_<branch-slug>` and password `Staff@12345`. These fixtures must not be used as production credentials.
