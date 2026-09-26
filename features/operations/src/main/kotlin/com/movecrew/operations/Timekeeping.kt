package com.movecrew.operations
import com.movecrew.domain.*
import com.movecrew.sales.JobId
import java.time.Instant
enum class TimeEventType{EMPLOYEE_CLOCK_IN,EMPLOYEE_CLOCK_OUT,BREAK_START,BREAK_END,JOB_JOIN,JOB_LEAVE}
data class TimeEvent(val id:String,val companyId:CompanyId,val employeeId:EmployeeId,val type:TimeEventType,val at:Instant,val jobId:JobId?=null)
data class ParticipationWindow(val employeeId:EmployeeId,val jobId:JobId,val start:Instant,val end:Instant?)
class TimeLedger{
 private val events=mutableListOf<TimeEvent>();private val ids=mutableSetOf<String>()
 @Synchronized fun append(e:TimeEvent):Boolean{if(!ids.add(e.id))return false;events+=e;return true}
 fun participation(c:CompanyId,j:JobId):List<ParticipationWindow>{val ev=events.filter{it.companyId==c&&it.jobId==j}.sortedBy{it.at};val open=mutableMapOf<EmployeeId,Instant>();val out=mutableListOf<ParticipationWindow>();for(e in ev)when(e.type){TimeEventType.JOB_JOIN->open.putIfAbsent(e.employeeId,e.at);TimeEventType.JOB_LEAVE->{val st=open.remove(e.employeeId);if(st!=null)out+=ParticipationWindow(e.employeeId,j,st,e.at)};else->{}};open.forEach{(emp,st)->out+=ParticipationWindow(emp,j,st,null)};return out}
}
