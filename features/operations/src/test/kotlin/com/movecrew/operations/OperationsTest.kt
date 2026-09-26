package com.movecrew.operations
import com.movecrew.domain.*
import com.movecrew.sales.JobId
import java.time.*
import kotlin.test.*
class OperationsTest{
 @Test fun transitionWarningDoesNotBlock(){val e=Instant.EPOCH;val a=TransitionEngine().assess(e,e.plusSeconds(1800),45);assertTrue(a.selectable);assertTrue(a.warning)}
 @Test fun phasesAreGuarded(){val s=JobExecution(JobId("j"),JobPhase.SCHEDULED,Instant.EPOCH,1);assertFails{JobPhaseService().transition(s,JobPhase.COMPLETED,Instant.EPOCH.plusSeconds(1))}}
 @Test fun partialParticipation(){val l=TimeLedger();val c=CompanyId("c");val j=JobId("j");val e=EmployeeId("jordan");l.append(TimeEvent("1",c,e,TimeEventType.JOB_JOIN,Instant.EPOCH,j));l.append(TimeEvent("2",c,e,TimeEventType.JOB_LEAVE,Instant.EPOCH.plusSeconds(3600),j));val p=l.participation(c,j).single();assertEquals(3600,Duration.between(p.start,p.end).seconds)}
 @Test fun retryIsIdempotent(){val l=TimeLedger();val e=TimeEvent("same",CompanyId("c"),EmployeeId("m"),TimeEventType.EMPLOYEE_CLOCK_IN,Instant.EPOCH);assertTrue(l.append(e));assertFalse(l.append(e))}
}
