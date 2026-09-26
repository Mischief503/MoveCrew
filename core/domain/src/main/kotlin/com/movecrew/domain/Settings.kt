package com.movecrew.domain

data class FeatureSettings(
    val payrollEnabled:Boolean=true,
    val accountingEnabled:Boolean=true,
    val chatEnabled:Boolean=true,
    val inventoryTrackingEnabled:Boolean=true
)

data class AppearanceSettings(val themeId:String="movecrew-blue")

data class CrewRate(val movers:Int,val trucks:Int,val hourlyRate:Money) {
    init { require(movers>0); require(trucks>=0); require(hourlyRate.cents>=0) }
}

data class PricingSettings(
    val crewRates:List<CrewRate>,
    val standardDiscountPercent:Int?=null
) {
    init { require(standardDiscountPercent==null || standardDiscountPercent in 0..100) }
}

data class CompanySettings(
    val companyId:CompanyId,
    val features:FeatureSettings,
    val pricing:PricingSettings,
    val appearance:AppearanceSettings,
    val version:Long
)
