package com.movecrew.sales
import com.movecrew.domain.*
import java.time.Instant
import kotlin.test.*
class SalesTest {
 private val settings=PricingSettings(listOf(CrewRate(2,1,Money.cents(15000)),CrewRate(3,1,Money.cents(20000))),10)
 @Test fun `crew configurations have independent rates`(){
  val e=PricingEngine()
  assertEquals(15000,e.snapshot(settings,2,1,Instant.EPOCH).hourlyRate.cents)
  assertEquals(20000,e.snapshot(settings,3,1,Instant.EPOCH).hourlyRate.cents)
 }
 @Test fun `historical snapshot does not change with settings`(){
  val e=PricingEngine();val old=e.snapshot(settings,2,1,Instant.EPOCH)
  val changed=settings.copy(crewRates=listOf(CrewRate(2,1,Money.cents(16500))))
  assertEquals(15000,old.hourlyRate.cents);assertEquals(16500,e.snapshot(changed,2,1,Instant.EPOCH).hourlyRate.cents)
 }
 @Test fun `discount is explicit line`(){
  val e=PricingEngine();val snap=e.snapshot(settings,2,1,Instant.EPOCH)
  val (lines,total)=e.hourlyEstimate(snap,4,applyStandardDiscount=true)
  assertEquals(2,lines.size);assertEquals(-6000,lines.last().amount.cents);assertEquals(54000,total.cents)
 }
 @Test fun `accepted estimate becomes job with frozen pricing`(){
  val snap=PricingEngine().snapshot(settings,3,1,Instant.EPOCH)
  val stop=MoveStop(1,Address("1 Main","Portland","OR","97201"))
  val est=Estimate(EstimateId("e"),CompanyId("c"),CustomerId("u"),1,EstimateStatus.ACCEPTED,listOf(stop),snap,emptyList(),Money.ZERO)
  val job=BookingService().book(est,JobId("j"))
  assertEquals(20000,job.pricing.hourlyRate.cents);assertEquals(3,job.requiredMovers)
 }
 @Test fun `unaccepted estimate cannot book`(){
  val snap=PricingEngine().snapshot(settings,2,1,Instant.EPOCH)
  val est=Estimate(EstimateId("e"),CompanyId("c"),CustomerId("u"),1,EstimateStatus.SENT,emptyList(),snap,emptyList(),Money.ZERO)
  assertFails{BookingService().book(est,JobId("j"))}
 }
}
