package com.movecrew.finance
import com.movecrew.domain.*
import java.time.*
@JvmInline value class PayrollRunId(val value:String)
enum class PayrollStatus{DRAFT,CALCULATED,FINALIZED,VOIDED}
enum class TipSettlementStatus{PENDING,INCLUDED_IN_PAYROLL,PAID_OUTSIDE_PAYROLL}
data class WageProfile(val employeeId:EmployeeId,val hourlyRate:Money)
data class PayrollInput(val employeeId:EmployeeId,val workedSeconds:Long,val tips:Money=Money.ZERO)
data class PayrollLine(val employeeId:EmployeeId,val regularPay:Money,val tips:Money,val grossPay:Money)
data class PayrollRun(val id:PayrollRunId,val companyId:CompanyId,val periodStart:LocalDate,val periodEnd:LocalDate,val status:PayrollStatus,val lines:List<PayrollLine>)
class PayrollEngine{
 fun calculate(input:PayrollInput,wage:WageProfile):PayrollLine{
  require(input.employeeId==wage.employeeId);require(input.workedSeconds>=0)
  val regular=Money.cents(wage.hourlyRate.cents*input.workedSeconds/3600)
  return PayrollLine(input.employeeId,regular,input.tips,regular+input.tips)
 }}
class PayrollService{
 private val finalized=mutableMapOf<PayrollRunId,PayrollRun>()
 fun finalize(run:PayrollRun,enabled:Boolean):PayrollRun{
  require(enabled){"Payroll module disabled"};finalized[run.id]?.let{return it}
  require(run.status==PayrollStatus.CALCULATED)
  return run.copy(status=PayrollStatus.FINALIZED).also{finalized[run.id]=it}
 }}
class TipSettlement{
 fun include(current:TipSettlementStatus):TipSettlementStatus{
  require(current!=TipSettlementStatus.PAID_OUTSIDE_PAYROLL){"Tip already paid outside payroll"}
  return TipSettlementStatus.INCLUDED_IN_PAYROLL
 }
 fun payOutside(current:TipSettlementStatus):TipSettlementStatus{
  require(current!=TipSettlementStatus.INCLUDED_IN_PAYROLL){"Tip already included in payroll"}
  return TipSettlementStatus.PAID_OUTSIDE_PAYROLL
 }}
