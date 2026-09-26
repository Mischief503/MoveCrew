plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.movecrew.android"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.movecrew"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
    buildTypes {
        debug { applicationIdSuffix = ".debug" }
        release { isMinifyEnabled = false }
    }
    flavorDimensions += "environment"
    productFlavors {
        create("testCompany") {
            dimension = "environment"
            applicationIdSuffix = ".test"
            buildConfigField("String", "APP_ENVIRONMENT", "\"TEST_COMPANY\"")
            manifestPlaceholders["entryActivity"] = "com.movecrew.android.TestCompanyActivity"
        }
        create("production") {
            dimension = "environment"
            buildConfigField("String", "APP_ENVIRONMENT", "\"PRODUCTION\"")
            manifestPlaceholders["entryActivity"] = "com.movecrew.android.MainActivity"
        }
    }
    buildFeatures { buildConfig = true }
}
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
    "testCompanyImplementation"(project(":test-support:fake-company"))
}
