package com.movecrew.inventory
import com.movecrew.domain.*
import java.time.Instant

enum class PurchaseStatus{DRAFT,SUBMITTED,PARTIALLY_RECEIVED,RECEIVED,CANCELLED}
data class PurchaseLine(val sku:Sku,val ordered:Int,val unitCost:Money){init{require(ordered>0);require(unitCost.cents>=0)}}
data class PurchaseOrder(val id:String,val companyId:CompanyId,val vendor:String,val lines:List<PurchaseLine>,val status:PurchaseStatus)
data class Receipt(val id:String,val purchaseOrderId:String,val warehouseId:String,val sku:Sku,val quantity:Int,val receivedAt:Instant){init{require(quantity>0)}}
class Replenishment{
 fun suggestedOrder(onHand:Int,reorderPoint:Int,target:Int):Int{
  require(onHand>=0&&reorderPoint>=0&&target>=reorderPoint)
  return if(onHand<=reorderPoint)maxOf(0,target-onHand) else 0
 }
}
class ReceivingLedger{
 private val received=mutableMapOf<Pair<String,Sku>,Int>();private val ids=mutableSetOf<String>()
 @Synchronized fun receive(po:PurchaseOrder,r:Receipt):Boolean{
  require(po.id==r.purchaseOrderId)
  val ordered=po.lines.singleOrNull{it.sku==r.sku}?.ordered?:error("SKU not on purchase order")
  if(!ids.add(r.id))return false
  val key=po.id to r.sku;val next=(received[key]?:0)+r.quantity
  require(next<=ordered){"Receipt exceeds ordered quantity"}
  received[key]=next;return true
 }
 fun received(poId:String,sku:Sku)=received[poId to sku]?:0
}
