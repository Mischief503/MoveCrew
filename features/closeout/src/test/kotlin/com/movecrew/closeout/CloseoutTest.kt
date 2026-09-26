package com.movecrew.closeout
import com.movecrew.domain.*
import com.movecrew.operations.ParticipationWindow
import com.movecrew.sales.JobId
import java.time.Instant
import kotlin.test.*
class CloseoutTest{
 @Test fun `material snapshot preserves historical price`(){
  val s=MaterialService();val item=MaterialCatalogItem(MaterialId("w"),CompanyId("c"),"20 inch wardrobe",Money.cents(2200))
  val snap=s.snapshot(item,Instant.EPOCH);val changed=item.copy(unitPrice=Money.cents(2500))
  assertEquals(2200,snap.unitPrice.cents);assertEquals(2500,changed.unitPrice.cents)
 }
 @Test fun `signature binds exact invoice version`(){
  val i=Invoice(InvoiceId("i"),CompanyId("c"),JobId("j"),3,listOf(InvoiceLine("L","Labor",1,Money.cents(10000))),InvoiceStatus.READY)
  val sig=CapturedSignature("Customer",listOf(SignaturePoint(0f,0f),SignaturePoint(1f,1f)),Instant.EPOCH,3)
  val signed=InvoiceService().sign(i,sig);assertEquals(InvoiceStatus.SIGNED,signed.status)
  val revised=InvoiceService().revise(signed,signed.lines);assertNull(revised.signature);assertEquals(4,revised.version)
 }
 @Test fun `tip allocation includes partial participant and totals exactly`(){
  val j=JobId("j");val start=Instant.EPOCH
  val w=listOf(
   ParticipationWindow(EmployeeId("liam"),j,start,start.plusSeconds(7200)),
   ParticipationWindow(EmployeeId("mike"),j,start,start.plusSeconds(7200)),
   ParticipationWindow(EmployeeId("jordan"),j,start.plusSeconds(3600),start.plusSeconds(7200)))
  val shares=TipAllocator().byParticipation(Money.cents(10000),w)
  assertEquals(10000,shares.sumOf{it.amount.cents});assertTrue(shares.single{it.employeeId==EmployeeId("jordan")}.amount.cents>0)
 }
}
