package com.movecrew.closeout
import com.movecrew.domain.*
import com.movecrew.operations.ParticipationWindow
import java.time.Duration
data class TipShare(val employeeId:EmployeeId,val amount:Money)
class TipAllocator{
 fun byParticipation(total:Money,windows:List<ParticipationWindow>):List<TipShare>{
  require(total.cents>=0);if(windows.isEmpty())return emptyList()
  val seconds=windows.associate{w->w.employeeId to maxOf(1L,Duration.between(w.start,w.end?:w.start.plusSeconds(1)).seconds)}
  val weight=seconds.values.sum();var remaining=total.cents
  val ids=seconds.keys.sortedBy{it.value}
  return ids.mapIndexed{i,id->
   val cents=if(i==ids.lastIndex)remaining else (total.cents*seconds.getValue(id)/weight)
   remaining-=cents;TipShare(id,Money.cents(cents))
  }
 }
}
