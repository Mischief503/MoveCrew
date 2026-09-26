package com.movecrew.inventory
import com.movecrew.domain.*
import com.movecrew.sales.JobId
import java.time.Instant

@JvmInline value class EquipmentId(val value:String)
enum class EquipmentStatus{AVAILABLE,ASSIGNED,MAINTENANCE,LOST,RETIRED}
sealed interface CustodyLocation{
 data class Warehouse(val warehouseId:String,val bin:String?):CustodyLocation
 data class Employee(val employeeId:EmployeeId):CustodyLocation
 data class Job(val jobId:JobId):CustodyLocation
 data class Vehicle(val vehicleId:String):CustodyLocation
 data class Maintenance(val vendorOrArea:String):CustodyLocation
}
data class Equipment(val id:EquipmentId,val companyId:CompanyId,val name:String,val status:EquipmentStatus)
data class EquipmentCustody(val equipmentId:EquipmentId,val location:CustodyLocation,val effectiveAt:Instant,val transferId:String)

class EquipmentCustodyLedger{
 private val current=mutableMapOf<EquipmentId,EquipmentCustody>()
 private val transferIds=mutableSetOf<String>()
 @Synchronized fun transfer(c:EquipmentCustody):Boolean{
  if(!transferIds.add(c.transferId))return false
  val prior=current[c.equipmentId]
  require(prior==null || !c.effectiveAt.isBefore(prior.effectiveAt)){"Custody transfer cannot move backward in time"}
  current[c.equipmentId]=c;return true
 }
 fun current(id:EquipmentId)=current[id]
}
