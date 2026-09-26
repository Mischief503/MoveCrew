package com.movecrew.auth

import com.movecrew.domain.*

enum class Permission {
    VIEW_ASSIGNED_JOB, VIEW_ALL_JOBS, EDIT_FIELD_NOTES, EDIT_OFFICE_NOTES,
    VIEW_DISPATCH, MANAGE_DISPATCH, VIEW_OWN_TIME, VIEW_CREW_TIME, MANAGE_TIME,
    VIEW_OWN_PAY, VIEW_PAYROLL, PROCESS_PAYROLL, VIEW_FLEET, MANAGE_FLEET,
    VIEW_WAREHOUSE, MANAGE_WAREHOUSE, VIEW_ACCOUNTING, MANAGE_ACCOUNTING,
    MANAGE_EMPLOYEES, MANAGE_COMPANY_SETTINGS
}

sealed interface ResourceScope {
    data object Self : ResourceScope
    data object AssignedJobs : ResourceScope
    data object AssignedCrew : ResourceScope
    data object Department : ResourceScope
    data object Company : ResourceScope
    data class Explicit(val entityIds: Set<String>) : ResourceScope
}

data class AuthorizationRequest(
    val companyId: CompanyId,
    val actorId: UserId,
    val permission: Permission,
    val resourceId: String? = null
)

sealed interface AuthorizationDecision {
    data object Allow : AuthorizationDecision
    data class Deny(val reason: String) : AuthorizationDecision
}

class AuthorizationService(
    private val permissionProvider: (CompanyId, UserId) -> Set<Permission>
) {
    fun authorize(request: AuthorizationRequest): AuthorizationDecision {
        val granted = permissionProvider(request.companyId, request.actorId)
        return if (request.permission in granted) AuthorizationDecision.Allow
        else AuthorizationDecision.Deny("Permission not granted")
    }
}
