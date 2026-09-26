package com.movecrew.finance
import com.movecrew.domain.*
import com.movecrew.closeout.InvoiceId
import java.time.*
import kotlin.test.*
class FinanceTest{
 @Test fun `capture retry does not charge twice`(){
  var calls=0;val g=object:PaymentGateway{override fun capture(k:String,a:Money)=GatewayResult(true,"ref-${++calls}",null);override fun refund(k:String,p:String,a:Money)=GatewayResult(true,"r",null)}
  val s=PaymentService(g);val p=Payment(PaymentId("p"),CompanyId("c"),InvoiceId("i"),Money.cents(10000),PaymentStatus.PENDING,null,Instant.EPOCH)
  assertEquals(s.capture("same",p),s.capture("same",p));assertEquals(1,calls)
 }
 @Test fun `unconfirmed payment never reports captured`(){
  val g=object:PaymentGateway{override fun capture(k:String,a:Money)=GatewayResult(false,null,"offline");override fun refund(k:String,p:String,a:Money)=GatewayResult(false,null,"offline")}
  val p=Payment(PaymentId("p"),CompanyId("c"),InvoiceId("i"),Money.cents(100),PaymentStatus.PENDING,null,Instant.EPOCH)
  assertEquals(PaymentStatus.FAILED,PaymentService(g).capture("k",p).status)
 }
 @Test fun `payroll finalize retry is idempotent`(){
  val run=PayrollRun(PayrollRunId("r"),CompanyId("c"),LocalDate.of(2026,9,1),LocalDate.of(2026,9,15),PayrollStatus.CALCULATED,emptyList())
  val s=PayrollService();assertEquals(s.finalize(run,true),s.finalize(run,true))
 }
 @Test fun `disabled payroll cannot finalize`(){
  val run=PayrollRun(PayrollRunId("r"),CompanyId("c"),LocalDate.MIN,LocalDate.MIN,PayrollStatus.CALCULATED,emptyList())
  assertFails{PayrollService().finalize(run,false)}
 }
 @Test fun `tip cannot be paid twice`(){
  val t=TipSettlement();val included=t.include(TipSettlementStatus.PENDING)
  assertFails{t.payOutside(included)}
 }
 @Test fun `receivable reflects refunds`(){
  val p=Payment(PaymentId("p"),CompanyId("c"),InvoiceId("i"),Money.cents(8000),PaymentStatus.CAPTURED,"x",Instant.EPOCH)
  val r=Refund("r",p.id,Money.cents(2000),"y",Instant.EPOCH)
  assertEquals(4000,Receivables().balance(Money.cents(10000),listOf(p),listOf(r)).cents)
 }}
