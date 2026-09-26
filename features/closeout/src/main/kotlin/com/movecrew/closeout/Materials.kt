package com.movecrew.closeout
import com.movecrew.domain.*
import com.movecrew.sales.JobId
import java.time.Instant
@JvmInline value class MaterialId(val value:String)
data class MaterialCatalogItem(val id:MaterialId,val companyId:CompanyId,val name:String,val unitPrice:Money,val active:Boolean=true)
data class MaterialSnapshot(val materialId:MaterialId,val name:String,val unitPrice:Money,val capturedAt:Instant)
data class JobMaterial(val jobId:JobId,val snapshot:MaterialSnapshot,val quantity:Int,val addedBy:UserId){init{require(quantity>0)};val total get()=Money.cents(snapshot.unitPrice.cents*quantity)}
class MaterialService{
 fun snapshot(item:MaterialCatalogItem,at:Instant)=MaterialSnapshot(item.id,item.name,item.unitPrice,at)
 fun createInField(id:MaterialId,companyId:CompanyId,name:String,price:Money)=MaterialCatalogItem(id,companyId,name,price)
}
