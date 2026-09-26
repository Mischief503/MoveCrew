package com.movecrew.fleet
import com.movecrew.domain.*
import com.movecrew.operations.VehicleId
import java.time.Instant
enum class VehicleStatus{AVAILABLE,ASSIGNED,MAINTENANCE,SAFETY_HOLD,RETIRED}
data class Vehicle(val id:VehicleId,val companyId:CompanyId,val unitNumber:String,val status:VehicleStatus,val odometer:Int)
data class Inspection(val id:String,val vehicleId:VehicleId,val at:Instant,val passed:Boolean,val notes:String)
enum class MaintenanceStatus{OPEN,IN_PROGRESS,COMPLETED,CANCELLED}
data class MaintenanceOrder(val id:String,val vehicleId:VehicleId,val description:String,val status:MaintenanceStatus,val safetyCritical:Boolean)
data class VehicleCustody(val vehicleId:VehicleId,val custodianEmployeeId:EmployeeId?,val location:String,val effectiveAt:Instant)
class FleetPolicy{
 fun dispatchable(v:Vehicle)=v.status==VehicleStatus.AVAILABLE
 fun afterInspection(v:Vehicle,i:Inspection)=if(i.passed)v else v.copy(status=VehicleStatus.SAFETY_HOLD)
 fun releaseSafetyHold(v:Vehicle,completedSafetyWork:Boolean):Vehicle{
  require(v.status==VehicleStatus.SAFETY_HOLD);require(completedSafetyWork){"Safety work must be completed"}
  return v.copy(status=VehicleStatus.AVAILABLE)
 }}
class VehicleCustodyLedger{
 private val current=mutableMapOf<VehicleId,VehicleCustody>()
 @Synchronized fun transfer(c:VehicleCustody){current[c.vehicleId]=c}
 fun current(vehicleId:VehicleId)=current[vehicleId]
}
