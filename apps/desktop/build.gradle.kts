plugins {
    kotlin("jvm")
    application
}
kotlin { jvmToolchain(17) }
dependencies {
    implementation(project(":core:domain"))
    implementation(project(":core:auth"))
    implementation(project(":core:data"))
    implementation(project(":features:sales"))
    implementation(project(":features:operations"))
    implementation(project(":features:closeout"))
    implementation(project(":features:finance"))
    implementation(project(":features:accounting"))
    implementation(project(":features:fleet"))
    implementation(project(":features:inventory"))
    implementation(project(":features:analytics"))
    implementation(project(":features:communications"))
    implementation(project(":features:documents"))
}
application { mainClass.set("com.movecrew.desktop.MainKt") }
