# Internal sign-in implementation

Implemented 2026-10-29 from the owner instruction to provide a cinema-specific Staff entry point.

- The public sign-in screen keeps Customer sign-in unchanged and adds `Internal Sign In` for Admins, Staff and Managers.
- Admins choose the system-administration option; Staff and Managers select an ACTIVE cinema before submitting credentials to `POST /api/auth/internal-login`.
- The internal form mirrors the Customer login controls and also supports Google through `POST /api/auth/internal-google`; Google never creates an internal account and only accepts an existing Admin, Staff or Manager email.
- The backend authenticates the password and requires an `ADMIN`, `STAFF` or `MANAGER` actor role. Admin is system-scoped and does not require a branch. Staff/Manager still require `employeeProfile.branchId` to match the selected ACTIVE cinema before the existing HTTP-only access cookie is issued.
- The normal `POST /api/auth/login` contract is unchanged.
- Development seed creates one deterministic Staff account per branch. Accounts for inactive branches are seeded `DISABLED`. The seed is idempotent and does not overwrite an existing seeded account password.

Development-only credentials use usernames `staff_<branch-slug>` and password `Staff@12345`. These fixtures must not be used as production credentials.
