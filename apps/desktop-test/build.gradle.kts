plugins { kotlin("jvm"); application }
kotlin { jvmToolchain(17) }
dependencies { implementation(project(":core:domain")); implementation(project(":test-support:fake-company")) }
application { mainClass.set("com.movecrew.desktoptest.MainKt") }
