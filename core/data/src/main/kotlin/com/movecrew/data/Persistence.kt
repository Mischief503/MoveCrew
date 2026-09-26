package com.movecrew.data
import com.movecrew.domain.*
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
interface CompanyScopedEntity { val companyId:CompanyId; val id:String }
interface CompanyScopedRepository<T:CompanyScopedEntity>{fun get(companyId:CompanyId,id:String):T?;fun list(companyId:CompanyId):List<T>;fun upsert(companyId:CompanyId,entity:T)}
class InMemoryCompanyRepository<T:CompanyScopedEntity>:CompanyScopedRepository<T>{
 private val rows=ConcurrentHashMap<Pair<CompanyId,String>,T>()
 override fun get(companyId:CompanyId,id:String)=rows[companyId to id]
 override fun list(companyId:CompanyId)=rows.filterKeys{it.first==companyId}.values.toList()
 override fun upsert(companyId:CompanyId,entity:T){require(entity.companyId==companyId){"Cross-company write denied"};rows[companyId to entity.id]=entity}}
enum class OperationType{CREATE,UPDATE,VOID,ARCHIVE,TRANSFER,POST}
enum class OutboxStatus{PENDING,COMPLETED,FAILED}
data class OutboxOperation(val id:String,val companyId:CompanyId,val actorId:UserId,val entityType:String,val entityId:String,val operationType:OperationType,val createdAt:Instant,val payload:String,val attemptCount:Int=0,val status:OutboxStatus=OutboxStatus.PENDING)
class OutboxStore{
 private val rows=linkedMapOf<String,OutboxOperation>()
 @Synchronized fun enqueue(op:OutboxOperation):Boolean{if(rows.containsKey(op.id))return false;rows[op.id]=op;return true}
 @Synchronized fun pending(companyId:CompanyId)=rows.values.filter{it.companyId==companyId&&it.status==OutboxStatus.PENDING}
 @Synchronized fun complete(id:String){rows[id]?.let{rows[id]=it.copy(status=OutboxStatus.COMPLETED)}}}
enum class ConflictType{SAFE_MERGE,PROTECTED,FINANCIAL,PHYSICAL_CUSTODY}
object ConflictRules{fun classify(t:String)=when(t.uppercase()){"PAYMENT","REFUND","INVOICE","PAYROLL","JOURNAL_ENTRY"->ConflictType.FINANCIAL;"VEHICLE_CUSTODY","EQUIPMENT_CUSTODY","CUSTOMER_STORAGE_CUSTODY"->ConflictType.PHYSICAL_CUSTODY;else->ConflictType.PROTECTED}}
