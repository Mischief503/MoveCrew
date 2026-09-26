package com.movecrew.domain
import kotlin.test.*
class PresentationTest{
 @Test fun themes(){assertEquals(13,ThemeCatalog.all.size);assertEquals(13,ThemeCatalog.all.map{it.id}.toSet().size)}
 @Test fun ownerIsNotPayroll(){assertFalse(AppSection.PAYROLL in RoleNavigation.sections(setOf(CompanyRole.OWNER)));assertTrue(AppSection.PAYROLL in RoleNavigation.sections(setOf(CompanyRole.PAYROLL)))}
}
