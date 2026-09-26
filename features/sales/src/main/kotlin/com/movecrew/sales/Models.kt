package com.movecrew.sales
import com.movecrew.domain.*
import java.time.Instant
@JvmInline value class CustomerId(val value:String)
@JvmInline value class LeadId(val value:String)
@JvmInline value class EstimateId(val value:String)
@JvmInline value class JobId(val value:String)
enum class CustomerStatus{PROSPECT,ACTIVE,INACTIVE,ARCHIVED}
enum class LeadStatus{NEW,CONTACTED,ESTIMATE_REQUIRED,ESTIMATE_SENT,FOLLOW_UP,WON,LOST}
enum class EstimateStatus{DRAFT,READY,SENT,ACCEPTED,DECLINED,EXPIRED,SUPERSEDED,CANCELLED}
data class Address(val line1:String,val city:String,val region:String,val postalCode:String)
data class Customer(val id:CustomerId,val companyId:CompanyId,val displayName:String,val phone:String?,val email:String?,val status:CustomerStatus)
data class Lead(val id:LeadId,val companyId:CompanyId,val name:String,val source:String,val status:LeadStatus)
data class MoveStop(val sequence:Int,val address:Address,val notes:String="")
data class EstimateLine(val code:String,val description:String,val amount:Money)
data class PricingSnapshot(val movers:Int,val trucks:Int,val hourlyRate:Money,val discountPercent:Int?,val capturedAt:Instant)
data class Estimate(
 val id:EstimateId,val companyId:CompanyId,val customerId:CustomerId,val version:Int,
 val status:EstimateStatus,val stops:List<MoveStop>,val pricing:PricingSnapshot,
 val lines:List<EstimateLine>,val total:Money
)
enum class NoteKind{OFFICE,FIELD}
data class JobNote(val kind:NoteKind,val authorId:UserId,val body:String,val createdAt:Instant)
data class Job(
 val id:JobId,val companyId:CompanyId,val customerId:CustomerId,val estimateId:EstimateId,
 val requiredMovers:Int,val requiredTrucks:Int,val stops:List<MoveStop>,
 val pricing:PricingSnapshot,val notes:List<JobNote> = emptyList()
)
