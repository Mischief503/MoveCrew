package com.movecrew.testsupport

import com.movecrew.domain.*

data class TestPerson(val identity: UserIdentity, val role: CompanyRole)

object FakeCompany {
    val companyId = CompanyId("test-company")
    val users = listOf(
        TestPerson(UserIdentity(UserId("alex"), "Alex Morgan"), CompanyRole.OWNER),
        TestPerson(UserIdentity(UserId("olivia"), "Olivia Carter"), CompanyRole.OFFICE),
        TestPerson(UserIdentity(UserId("derek"), "Derek Brooks"), CompanyRole.DISPATCHER),
        TestPerson(UserIdentity(UserId("liam"), "Liam Reed"), CompanyRole.LEAD),
        TestPerson(UserIdentity(UserId("mike"), "Mike Torres"), CompanyRole.MOVER),
        TestPerson(UserIdentity(UserId("will"), "Will Parker"), CompanyRole.WAREHOUSE),
        TestPerson(UserIdentity(UserId("frank"), "Frank Miller"), CompanyRole.FLEET),
        TestPerson(UserIdentity(UserId("alice"), "Alice Bennett"), CompanyRole.ACCOUNTING),
        TestPerson(UserIdentity(UserId("paige"), "Paige Collins"), CompanyRole.PAYROLL)
    )
}
