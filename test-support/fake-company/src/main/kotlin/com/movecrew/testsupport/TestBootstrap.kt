package com.movecrew.testsupport
import com.movecrew.domain.*
import java.time.Instant

data class TestCompanyState(
    val company:Company,
    val employees:List<Employee>,
    val memberships:List<CompanyMembership>,
    val settings:CompanySettings
)

object TestBootstrap {
    fun create():TestCompanyState {
        val now=Instant.parse("2026-09-25T00:00:00Z")
        val company=Company(FakeCompany.companyId,"MoveCrew Test LLC","MoveCrew Test Company",
            CompanyStatus.ACTIVE,"America/Los_Angeles","USD",now)
        val employees=FakeCompany.users.mapIndexed { index,p ->
            Employee(EmployeeId("emp-${index+1}"),company.id,"T%03d".format(index+1),
                p.identity.id,p.identity.displayName.substringBeforeLast(" "),
                p.identity.displayName.substringAfterLast(" "),EmploymentStatus.ACTIVE,now)
        }
        val memberships=FakeCompany.users.mapIndexed { index,p ->
            CompanyMembership(MembershipId("membership-${index+1}"),company.id,p.identity.id,
                setOf(p.role),MembershipStatus.ACTIVE)
        }
        val settings=CompanySettings(company.id,
            FeatureSettings(payrollEnabled=true,accountingEnabled=true,chatEnabled=true),
            PricingSettings(listOf(
                CrewRate(2,1,Money.cents(15000)),
                CrewRate(3,1,Money.cents(20000))
            ), standardDiscountPercent=10),
            AppearanceSettings(),1)
        return TestCompanyState(company,employees,memberships,settings)
    }
}
