package com.movecrew.operations
import com.movecrew.domain.*
import com.movecrew.sales.JobId
import java.time.*
@JvmInline value class VehicleId(val value:String)
enum class JobPhase{SCHEDULED,EN_ROUTE,ARRIVED,WORKING,PAUSED,CLOSEOUT,COMPLETED,CANCELLED}
enum class AssignmentStatus{PLANNED,ACCEPTED,ACTIVE,RELEASED,CANCELLED}
data class WorkWindow(val start:Instant,val end:Instant){init{require(!end.isBefore(start))}}
data class CrewAssignment(val jobId:JobId,val employeeId:EmployeeId,val window:WorkWindow,val status:AssignmentStatus)
data class TruckAssignment(val jobId:JobId,val vehicleId:VehicleId,val window:WorkWindow,val status:AssignmentStatus)
data class TransitionAssessment(val selectable:Boolean,val warning:Boolean,val travelMinutes:Int,val availableMinutes:Int,val message:String?)
class TransitionEngine{fun assess(end:Instant,next:Instant,travelMinutes:Int):TransitionAssessment{require(travelMinutes>=0);val available=Duration.between(end,next).toMinutes().toInt();val bad=available<travelMinutes;return TransitionAssessment(true,bad,travelMinutes,available,if(bad)"Insufficient transition time — selectable with warning" else null)}}
data class JobExecution(val jobId:JobId,val phase:JobPhase,val phaseStartedAt:Instant,val version:Long)
class JobPhaseService{
 private val allowed=mapOf(JobPhase.SCHEDULED to setOf(JobPhase.EN_ROUTE,JobPhase.CANCELLED),JobPhase.EN_ROUTE to setOf(JobPhase.ARRIVED,JobPhase.CANCELLED),JobPhase.ARRIVED to setOf(JobPhase.WORKING,JobPhase.CANCELLED),JobPhase.WORKING to setOf(JobPhase.PAUSED,JobPhase.CLOSEOUT),JobPhase.PAUSED to setOf(JobPhase.WORKING,JobPhase.CLOSEOUT),JobPhase.CLOSEOUT to setOf(JobPhase.COMPLETED,JobPhase.WORKING))
 fun transition(s:JobExecution,to:JobPhase,at:Instant):JobExecution{require(to in (allowed[s.phase]?:emptySet()));require(!at.isBefore(s.phaseStartedAt));return s.copy(phase=to,phaseStartedAt=at,version=s.version+1)}
}
