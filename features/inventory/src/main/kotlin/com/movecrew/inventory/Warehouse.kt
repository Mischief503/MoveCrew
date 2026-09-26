package com.movecrew.inventory
import com.movecrew.domain.*
import java.time.Instant

@JvmInline value class Sku(val value:String)
data class Warehouse(val id:String,val companyId:CompanyId,val name:String)
data class StockKey(val warehouseId:String,val sku:Sku)
data class StockMovement(val id:String,val companyId:CompanyId,val sku:Sku,val fromWarehouse:String?,val toWarehouse:String?,val quantity:Int,val occurredAt:Instant){
 init{require(quantity>0);require(fromWarehouse!=null || toWarehouse!=null);require(fromWarehouse!=toWarehouse)}
}
class StockLedger{
 private val balances=mutableMapOf<StockKey,Int>()
 private val movementIds=mutableSetOf<String>()
 @Synchronized fun apply(m:StockMovement):Boolean{
  if(!movementIds.add(m.id))return false
  if(m.fromWarehouse!=null){
   val key=StockKey(m.fromWarehouse,m.sku);val have=balances[key]?:0
   require(have>=m.quantity){"Insufficient stock"}
   balances[key]=have-m.quantity
  }
  if(m.toWarehouse!=null){
   val key=StockKey(m.toWarehouse,m.sku);balances[key]=(balances[key]?:0)+m.quantity
  }
  return true
 }
 fun balance(warehouseId:String,sku:Sku)=balances[StockKey(warehouseId,sku)]?:0
}
