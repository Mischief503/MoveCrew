plugins { kotlin("jvm") }
kotlin { jvmToolchain(17) }
dependencies { implementation(project(":core:domain")); implementation(project(":features:sales")); testImplementation(kotlin("test")) }
tasks.test { useJUnitPlatform() }
