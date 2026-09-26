pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "MoveCrew"
include(":core:domain", ":core:auth", ":core:data", ":test-support:fake-company", ":features:sales", ":features:operations", ":features:closeout", ":features:finance", ":features:accounting", ":features:fleet", ":features:inventory", ":features:analytics", ":features:communications", ":features:documents", ":apps:android", ":apps:desktop", ":apps:desktop-test")
