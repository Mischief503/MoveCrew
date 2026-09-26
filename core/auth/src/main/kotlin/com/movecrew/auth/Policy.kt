package com.movecrew.auth
import com.movecrew.domain.*

enum class DataVisibility { PUBLIC_COMPANY, OPERATIONAL, MANAGEMENT, CONFIDENTIAL, EMPLOYEE_PRIVATE }

data class PermissionGrant(
    val permission:Permission,
    val scope:ResourceScope
)

data class AccessContext(
    val membership:CompanyMembership,
    val grants:Set<PermissionGrant>
)

class PolicyEngine {
    fun decide(
        context:AccessContext,
        request:AuthorizationRequest,
        visibility:DataVisibility = DataVisibility.OPERATIONAL,
        subjectUserId:UserId? = null
    ):AuthorizationDecision {
        if(context.membership.companyId != request.companyId)
            return AuthorizationDecision.Deny("Cross-company access denied")
        if(context.membership.status != MembershipStatus.ACTIVE)
            return AuthorizationDecision.Deny("Membership is not active")
        val matching=context.grants.filter{it.permission==request.permission}
        if(matching.isEmpty()) return AuthorizationDecision.Deny("Permission not granted")
        if(visibility==DataVisibility.EMPLOYEE_PRIVATE && subjectUserId!=null &&
            subjectUserId!=context.membership.userId &&
            matching.none{it.scope==ResourceScope.Company})
            return AuthorizationDecision.Deny("Employee-private resource outside scope")
        return AuthorizationDecision.Allow
    }
}

object DefaultRolePermissions {
    fun grants(role:CompanyRole):Set<PermissionGrant> = when(role) {
        CompanyRole.OWNER -> setOf(
            PermissionGrant(Permission.MANAGE_COMPANY_SETTINGS,ResourceScope.Company),
            PermissionGrant(Permission.MANAGE_EMPLOYEES,ResourceScope.Company)
        )
        CompanyRole.OFFICE -> setOf(
            PermissionGrant(Permission.VIEW_ALL_JOBS,ResourceScope.Company),
            PermissionGrant(Permission.EDIT_OFFICE_NOTES,ResourceScope.Company)
        )
        CompanyRole.DISPATCHER -> setOf(
            PermissionGrant(Permission.VIEW_DISPATCH,ResourceScope.Company),
            PermissionGrant(Permission.MANAGE_DISPATCH,ResourceScope.Company)
        )
        CompanyRole.LEAD -> setOf(
            PermissionGrant(Permission.VIEW_ASSIGNED_JOB,ResourceScope.AssignedJobs),
            PermissionGrant(Permission.EDIT_FIELD_NOTES,ResourceScope.AssignedJobs),
            PermissionGrant(Permission.VIEW_CREW_TIME,ResourceScope.AssignedCrew)
        )
        CompanyRole.MOVER -> setOf(
            PermissionGrant(Permission.VIEW_ASSIGNED_JOB,ResourceScope.AssignedJobs),
            PermissionGrant(Permission.VIEW_OWN_TIME,ResourceScope.Self),
            PermissionGrant(Permission.VIEW_OWN_PAY,ResourceScope.Self)
        )
        CompanyRole.WAREHOUSE -> setOf(PermissionGrant(Permission.MANAGE_WAREHOUSE,ResourceScope.Department))
        CompanyRole.FLEET -> setOf(PermissionGrant(Permission.MANAGE_FLEET,ResourceScope.Department))
        CompanyRole.ACCOUNTING -> setOf(PermissionGrant(Permission.MANAGE_ACCOUNTING,ResourceScope.Department))
        CompanyRole.PAYROLL -> setOf(
            PermissionGrant(Permission.VIEW_PAYROLL,ResourceScope.Department),
            PermissionGrant(Permission.PROCESS_PAYROLL,ResourceScope.Department)
        )
    }
}
