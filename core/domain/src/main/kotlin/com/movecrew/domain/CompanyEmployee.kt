package com.movecrew.domain
import java.time.Instant

@JvmInline value class EmployeeId(val value:String)
enum class CompanyStatus { SETUP, ACTIVE, SUSPENDED, ARCHIVED }
enum class EmploymentStatus { INVITED, ACTIVE, LEAVE, INACTIVE, TERMINATED }

data class Company(
    val id:CompanyId, val legalName:String, val displayName:String,
    val status:CompanyStatus, val timeZoneId:String, val currencyCode:String,
    val createdAt:Instant
)

data class Employee(
    val id:EmployeeId, val companyId:CompanyId, val employeeNumber:String,
    val userId:UserId?, val firstName:String, val lastName:String,
    val status:EmploymentStatus, val createdAt:Instant
)

data class RoleAssignment(
    val companyId:CompanyId, val employeeId:EmployeeId, val role:CompanyRole,
    val effectiveFrom:Instant, val effectiveTo:Instant?=null
)

data class UserSession(
    val sessionId:String, val userId:UserId, val companyId:CompanyId,
    val membershipId:MembershipId, val authenticatedAt:Instant
)
