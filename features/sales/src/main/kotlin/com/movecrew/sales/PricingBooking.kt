package com.movecrew.sales
import com.movecrew.domain.*
import java.time.Instant
class PricingEngine {
 fun snapshot(settings:PricingSettings,movers:Int,trucks:Int,at:Instant):PricingSnapshot {
  val rate=settings.crewRates.singleOrNull{it.movers==movers&&it.trucks==trucks}
   ?: error("No configured rate for $movers movers / $trucks trucks")
  return PricingSnapshot(movers,trucks,rate.hourlyRate,settings.standardDiscountPercent,at)
 }
 fun hourlyEstimate(snapshot:PricingSnapshot,hours:Int,extra:List<EstimateLine> = emptyList(),applyStandardDiscount:Boolean=false):Pair<List<EstimateLine>,Money>{
  require(hours>=0)
  val labor=EstimateLine("LABOR","${snapshot.movers} movers / ${snapshot.trucks} truck(s), $hours hour(s)",Money.cents(snapshot.hourlyRate.cents*hours))
  val base=(listOf(labor)+extra)
  val subtotal=base.fold(Money.ZERO){a,l->a+l.amount}
  val discount=if(applyStandardDiscount && snapshot.discountPercent!=null)
    Money.cents(-(subtotal.cents*snapshot.discountPercent/100)) else Money.ZERO
  val lines=if(discount.cents!=0L) base+EstimateLine("DISCOUNT","Standard discount",discount) else base
  return lines to lines.fold(Money.ZERO){a,l->a+l.amount}
 }
}
class BookingService {
 fun book(estimate:Estimate,jobId:JobId):Job {
  require(estimate.status==EstimateStatus.ACCEPTED){"Only accepted estimates can be booked"}
  return Job(jobId,estimate.companyId,estimate.customerId,estimate.id,
   estimate.pricing.movers,estimate.pricing.trucks,estimate.stops,estimate.pricing)
 }
}
