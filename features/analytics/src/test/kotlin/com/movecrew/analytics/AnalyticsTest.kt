package com.movecrew.analytics
import com.movecrew.domain.*
import java.time.LocalDate
import kotlin.test.*
class AnalyticsTest{
 @Test fun `job costing reconciles`(){
  val r=JobCosting().calculate(JobCostInput(Money.cents(100000),Money.cents(40000),Money.cents(10000),Money.cents(5000),Money.cents(5000)))
  assertEquals(60000,r.totalCost.cents);assertEquals(40000,r.grossProfit.cents);assertEquals(4000,r.marginBasisPoints)
 }
 @Test fun `utilization uses worked time denominator`(){
  val k=EmployeeAnalytics().calculate(EmployeeOpsInput(28800,28800,21600));assertEquals(7500,k.utilizationBasisPoints)
 }
 @Test fun `dispatch warnings are measured without treating assignments as invalid`(){
  val k=DispatchAnalytics().calculate(DispatchInput(9,1,2,10));assertEquals(9000,k.assignmentCoverageBasisPoints);assertEquals(2000,k.warningRateBasisPoints)
 }
 @Test fun `sales conversion uses explicit denominators`(){
  val k=SalesAnalytics().calculate(SalesInput(20,10,4,Money.cents(100000)));assertEquals(5000,k.leadToEstimateBasisPoints);assertEquals(4000,k.estimateToBookBasisPoints)
 }
 @Test fun `budget variance signs are preserved`(){
  val b=BudgetPeriod(LocalDate.of(2026,1,1),LocalDate.of(2026,1,31),Money.cents(100000),Money.cents(60000))
  val v=Budgeting().variance(b,ActualPeriod(Money.cents(110000),Money.cents(65000)));assertEquals(10000,v.revenueVariance.cents);assertEquals(5000,v.profitVariance.cents)
 }
 @Test fun `forecast is deterministic`(){
  val f=Forecasting().simple(ForecastInput(listOf(Money.cents(100),Money.cents(200),Money.cents(300)),Money.cents(50)));assertEquals(250,f.projected.cents)
 }}
