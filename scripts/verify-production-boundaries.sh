#!/usr/bin/env bash
set -euo pipefail
if grep -R --line-number -E 'FakeCompany|TestUserSwitcher|testsupport' apps/desktop/src apps/android/src/main 2>/dev/null; then echo "test code leaked into production source";exit 1;fi
if grep -q 'test-support:fake-company' apps/desktop/build.gradle.kts; then echo "production desktop depends on fake company";exit 1;fi
echo "Production boundary verification passed."
