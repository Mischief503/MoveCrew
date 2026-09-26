package com.movecrew.domain

import java.time.Instant
import java.util.UUID

@JvmInline value class CompanyId(val value: String)
@JvmInline value class UserId(val value: String)
@JvmInline value class MembershipId(val value: String)
@JvmInline value class AuditEventId(val value: String)

fun newCompanyId() = CompanyId(UUID.randomUUID().toString())
fun newUserId() = UserId(UUID.randomUUID().toString())
fun newMembershipId() = MembershipId(UUID.randomUUID().toString())

data class Money private constructor(val cents: Long) {
    operator fun plus(other: Money) = Money(cents + other.cents)
    operator fun minus(other: Money) = Money(cents - other.cents)
    companion object {
        val ZERO = Money(0)
        fun cents(value: Long) = Money(value)
    }
}

enum class AppEnvironment { TEST_COMPANY, DEVELOPMENT, PRODUCTION }

enum class CompanyRole {
    OWNER, OFFICE, DISPATCHER, LEAD, MOVER, WAREHOUSE, FLEET, ACCOUNTING, PAYROLL
}

enum class MembershipStatus { INVITED, ACTIVE, SUSPENDED, REVOKED }

data class CompanyMembership(
    val id: MembershipId,
    val companyId: CompanyId,
    val userId: UserId,
    val roles: Set<CompanyRole>,
    val status: MembershipStatus
)

data class UserIdentity(val id: UserId, val displayName: String)

data class AuditEvent(
    val id: AuditEventId,
    val companyId: CompanyId,
    val actorId: UserId,
    val type: String,
    val occurredAt: Instant,
    val subjectId: String? = null
)
