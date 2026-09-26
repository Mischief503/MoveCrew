plugins { kotlin("jvm") }
kotlin { jvmToolchain(17) }
dependencies { implementation(project(":core:domain")); implementation(project(":core:data")); testImplementation(kotlin("test")) }
tasks.test { useJUnitPlatform() }
