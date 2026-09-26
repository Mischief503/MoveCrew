package com.movecrew.auth

import com.movecrew.domain.*
import kotlin.test.*

class AuthorizationTest {
    @Test fun `owner is not automatically god mode`() {
        val company = CompanyId("company")
        val owner = UserId("owner")
        val auth = AuthorizationService { _, _ -> emptySet() }
        assertIs<AuthorizationDecision.Deny>(
            auth.authorize(AuthorizationRequest(company, owner, Permission.VIEW_PAYROLL))
        )
    }

    @Test fun `explicit permission allows operation`() {
        val auth = AuthorizationService { _, _ -> setOf(Permission.MANAGE_DISPATCH) }
        assertEquals(
            AuthorizationDecision.Allow,
            auth.authorize(
                AuthorizationRequest(CompanyId("c"), UserId("dispatcher"), Permission.MANAGE_DISPATCH)
            )
        )
    }
}
