package com.movecrew.fleet
import com.movecrew.domain.*
import com.movecrew.operations.VehicleId
import java.time.Instant
import kotlin.test.*
class FleetTest{
 @Test fun `failed inspection creates non dispatchable safety hold`(){
  val v=Vehicle(VehicleId("18"),CompanyId("c"),"18",VehicleStatus.AVAILABLE,1000)
  val held=FleetPolicy().afterInspection(v,Inspection("i",v.id,Instant.EPOCH,false,"brakes"))
  assertEquals(VehicleStatus.SAFETY_HOLD,held.status);assertFalse(FleetPolicy().dispatchable(held))
 }
 @Test fun `safety hold cannot release without completed work`(){
  val v=Vehicle(VehicleId("18"),CompanyId("c"),"18",VehicleStatus.SAFETY_HOLD,1000)
  assertFails{FleetPolicy().releaseSafetyHold(v,false)}
 }
 @Test fun `vehicle has one authoritative current custody`(){
  val l=VehicleCustodyLedger();val id=VehicleId("12")
  l.transfer(VehicleCustody(id,EmployeeId("a"),"yard",Instant.EPOCH))
  l.transfer(VehicleCustody(id,EmployeeId("b"),"job",Instant.EPOCH.plusSeconds(1)))
  assertEquals(EmployeeId("b"),l.current(id)?.custodianEmployeeId)
 }}
