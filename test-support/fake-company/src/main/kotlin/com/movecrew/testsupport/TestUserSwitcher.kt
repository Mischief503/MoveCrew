package com.movecrew.testsupport
import com.movecrew.domain.*
import java.time.Instant
import java.util.UUID

class TestUserSwitcher {
    private var current:UserSession?=null
    fun current()=current
    fun switchTo(userId:UserId):UserSession {
        require(FakeCompany.users.any{it.identity.id==userId}){"Unknown artificial test user"}
        return UserSession(UUID.randomUUID().toString(),userId,FakeCompany.companyId,
            MembershipId("test-${userId.value}"),Instant.now()).also{current=it}
    }
}
