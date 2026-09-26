# MoveCrew
MoveCrew is a Kotlin moving-company operations application with native Android and Windows desktop targets and shared domain logic.

## Build targets
- Android `testCompanyDebug`: artificial Test Company + user switcher
- Android `productionRelease`: production app; fake-company dependency excluded
- Windows `:apps:desktop`: production desktop
- Windows `:apps:desktop-test`: separate test-company desktop

GitHub Actions installs JDK 17 and Gradle 8.9, runs tests/security checks, builds Android APK/AAB artifacts, and builds Windows ZIP/MSI artifacts.

## Locked invariants
Employee Clock, Job Clock, and participation are distinct. Assignment is not participation. Financial operations use idempotency boundaries.
Physical custody is authoritative. Transition warnings warn rather than automatically blocking the quickest worker. A production Owner does
not receive employee impersonation or blanket private payroll/direct-message access merely by being Owner.

## Deployment integrations
Real production deployment still requires environment-specific signing/secrets and configured providers for payments, remote sync/backend,
payroll/tax rules, and any enabled AI integrations. The code intentionally never invents credentials or reports unconfirmed external actions as successful.
