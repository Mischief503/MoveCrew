#!/usr/bin/env sh
if command -v gradle >/dev/null 2>&1; then exec gradle "$@"; fi
echo "Gradle is not installed. Generate/commit the canonical Gradle wrapper or use the GitHub setup-gradle action." >&2
exit 1
