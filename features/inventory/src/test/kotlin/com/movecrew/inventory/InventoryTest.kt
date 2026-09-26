package com.movecrew.inventory
import com.movecrew.domain.*
import com.movecrew.sales.CustomerId
import java.time.Instant
import kotlin.test.*

class InventoryTest{
 @Test fun `equipment has one current custody and retries do not duplicate`(){
  val l=EquipmentCustodyLedger();val id=EquipmentId("dolly-1")
  assertTrue(l.transfer(EquipmentCustody(id,CustodyLocation.Warehouse("main","A1"),Instant.EPOCH,"t1")))
  assertFalse(l.transfer(EquipmentCustody(id,CustodyLocation.Job(com.movecrew.sales.JobId("j")),Instant.EPOCH.plusSeconds(1),"t1")))
  assertTrue(l.transfer(EquipmentCustody(id,CustodyLocation.Job(com.movecrew.sales.JobId("j")),Instant.EPOCH.plusSeconds(1),"t2")))
  assertIs<CustodyLocation.Job>(l.current(id)?.location)
 }
 @Test fun `warehouse transfer conserves quantity`(){
  val l=StockLedger();val sku=Sku("pads")
  l.apply(StockMovement("receive",CompanyId("c"),sku,null,"A",20,Instant.EPOCH))
  l.apply(StockMovement("move",CompanyId("c"),sku,"A","B",7,Instant.EPOCH.plusSeconds(1)))
  assertEquals(13,l.balance("A",sku));assertEquals(7,l.balance("B",sku))
 }
 @Test fun `customer property cannot be released below zero`(){
  val l=CustomerStorageLedger();val lot=StorageLotId("lot")
  l.apply(StorageCustodyEvent("in",lot,5,"vault",Instant.EPOCH))
  assertFails{l.apply(StorageCustodyEvent("out",lot,-6,"vault",Instant.EPOCH.plusSeconds(1)))}
 }
 @Test fun `receiving cannot exceed purchase order`(){
  val sku=Sku("wrap");val po=PurchaseOrder("po",CompanyId("c"),"vendor",listOf(PurchaseLine(sku,10,Money.cents(100))),PurchaseStatus.SUBMITTED)
  val l=ReceivingLedger();assertTrue(l.receive(po,Receipt("r1","po","main",sku,6,Instant.EPOCH)))
  assertFails{l.receive(po,Receipt("r2","po","main",sku,5,Instant.EPOCH.plusSeconds(1)))}
 }
 @Test fun `replenishment triggers at reorder point`(){
  assertEquals(15,Replenishment().suggestedOrder(5,5,20));assertEquals(0,Replenishment().suggestedOrder(6,5,20))
 }
}
