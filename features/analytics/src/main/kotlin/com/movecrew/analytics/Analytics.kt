package com.movecrew.analytics
import com.movecrew.domain.*
import java.time.LocalDate

data class JobCostInput(val revenue:Money,val labor:Money,val materials:Money,val fuel:Money,val other:Money)
data class JobCostResult(val revenue:Money,val totalCost:Money,val grossProfit:Money,val marginBasisPoints:Int)
class JobCosting{
 fun calculate(i:JobCostInput):JobCostResult{
  val cost=i.labor+i.materials+i.fuel+i.other
  val profit=i.revenue-cost
  val margin=if(i.revenue.cents==0L)0 else ((profit.cents*10000)/i.revenue.cents).toInt()
  return JobCostResult(i.revenue,cost,profit,margin)
 }}
data class EmployeeOpsInput(val scheduledSeconds:Long,val workedSeconds:Long,val jobSeconds:Long)
data class EmployeeOpsKpi(val utilizationBasisPoints:Int,val scheduleAdherenceBasisPoints:Int)
class EmployeeAnalytics{
 fun calculate(i:EmployeeOpsInput):EmployeeOpsKpi{
  require(i.scheduledSeconds>=0&&i.workedSeconds>=0&&i.jobSeconds>=0)
  val util=if(i.workedSeconds==0L)0 else (i.jobSeconds*10000/i.workedSeconds).coerceIn(0,10000).toInt()
  val adherence=if(i.scheduledSeconds==0L)0 else (i.workedSeconds*10000/i.scheduledSeconds).coerceIn(0,10000).toInt()
  return EmployeeOpsKpi(util,adherence)
 }}
data class DispatchInput(val assignedJobs:Int,val unassignedJobs:Int,val warningAssignments:Int,val totalAssignments:Int)
data class DispatchKpi(val assignmentCoverageBasisPoints:Int,val warningRateBasisPoints:Int)
class DispatchAnalytics{
 fun calculate(i:DispatchInput):DispatchKpi{
  val jobs=i.assignedJobs+i.unassignedJobs
  return DispatchKpi(if(jobs==0)0 else i.assignedJobs*10000/jobs,if(i.totalAssignments==0)0 else i.warningAssignments*10000/i.totalAssignments)
 }}
data class SalesInput(val leads:Int,val estimates:Int,val booked:Int,val bookedRevenue:Money)
data class SalesKpi(val leadToEstimateBasisPoints:Int,val estimateToBookBasisPoints:Int,val bookedRevenue:Money)
class SalesAnalytics{
 fun calculate(i:SalesInput)=SalesKpi(if(i.leads==0)0 else i.estimates*10000/i.leads,if(i.estimates==0)0 else i.booked*10000/i.estimates,i.bookedRevenue)
}
data class BudgetPeriod(val start:LocalDate,val end:LocalDate,val revenueBudget:Money,val expenseBudget:Money)
data class ActualPeriod(val revenue:Money,val expense:Money)
data class BudgetVariance(val revenueVariance:Money,val expenseVariance:Money,val profitVariance:Money)
class Budgeting{
 fun variance(b:BudgetPeriod,a:ActualPeriod):BudgetVariance{
  val budgetProfit=b.revenueBudget-b.expenseBudget;val actualProfit=a.revenue-a.expense
  return BudgetVariance(a.revenue-b.revenueBudget,a.expense-b.expenseBudget,actualProfit-budgetProfit)
 }}
data class ForecastInput(val historicalRevenue:List<Money>,val bookedFutureRevenue:Money)
data class Forecast(val baseline:Money,val booked:Money,val projected:Money)
class Forecasting{
 fun simple(i:ForecastInput):Forecast{
  val avg=if(i.historicalRevenue.isEmpty())Money.ZERO else Money.cents(i.historicalRevenue.sumOf{it.cents}/i.historicalRevenue.size)
  return Forecast(avg,i.bookedFutureRevenue,avg+i.bookedFutureRevenue)
 }}
data class CommandCenterSnapshot(
 val asOf:LocalDate,val revenue:Money,val receivables:Money,val grossProfit:Money,
 val jobsToday:Int,val unassignedJobs:Int,val fleetSafetyHolds:Int,val lowStockItems:Int
)
