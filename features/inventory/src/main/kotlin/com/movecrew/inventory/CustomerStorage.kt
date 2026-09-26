package com.movecrew.inventory
import com.movecrew.domain.*
import com.movecrew.sales.CustomerId
import java.time.Instant

@JvmInline value class StorageLotId(val value:String)
enum class StorageLotStatus{RECEIVING,STORED,PARTIAL_RELEASE,RELEASED}
data class CustomerStorageLot(val id:StorageLotId,val companyId:CompanyId,val customerId:CustomerId,val location:String,val status:StorageLotStatus,val pieceCount:Int){
 init{require(pieceCount>=0)}
}
data class StorageCustodyEvent(val id:String,val lotId:StorageLotId,val deltaPieces:Int,val location:String,val at:Instant)
class CustomerStorageLedger{
 private val counts=mutableMapOf<StorageLotId,Int>();private val ids=mutableSetOf<String>()
 @Synchronized fun apply(e:StorageCustodyEvent):Boolean{
  if(!ids.add(e.id))return false
  val next=(counts[e.lotId]?:0)+e.deltaPieces
  require(next>=0){"Cannot release more customer property than held"}
  counts[e.lotId]=next;return true
 }
 fun heldPieces(id:StorageLotId)=counts[id]?:0
}
