package com.movecrew.auth
import com.movecrew.domain.*
import kotlin.test.*

class PolicyTest {
 @Test fun `owner does not inherit payroll`() {
   assertFalse(DefaultRolePermissions.grants(CompanyRole.OWNER).any{it.permission==Permission.VIEW_PAYROLL})
 }
 @Test fun `cross company denied`() {
   val m=CompanyMembership(MembershipId("m"),CompanyId("A"),UserId("u"),setOf(CompanyRole.OWNER),MembershipStatus.ACTIVE)
   val ctx=AccessContext(m,setOf(PermissionGrant(Permission.MANAGE_EMPLOYEES,ResourceScope.Company)))
   assertIs<AuthorizationDecision.Deny>(PolicyEngine().decide(ctx,
      AuthorizationRequest(CompanyId("B"),UserId("u"),Permission.MANAGE_EMPLOYEES)))
 }
 @Test fun `mover gets own pay but not payroll department`() {
   val grants=DefaultRolePermissions.grants(CompanyRole.MOVER)
   assertTrue(grants.any{it.permission==Permission.VIEW_OWN_PAY})
   assertFalse(grants.any{it.permission==Permission.VIEW_PAYROLL})
 }
}
