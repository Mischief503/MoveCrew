package com.movecrew.testsupport
import com.movecrew.domain.*
import kotlin.test.*

class BootstrapTest {
 @Test fun `bootstrap has nine core identities`() { assertEquals(9,TestBootstrap.create().employees.size) }
 @Test fun `pricing combinations remain independent`() {
   val rates=TestBootstrap.create().settings.pricing.crewRates
   assertEquals(15000,rates.single{it.movers==2&&it.trucks==1}.hourlyRate.cents)
   assertEquals(20000,rates.single{it.movers==3&&it.trucks==1}.hourlyRate.cents)
 }
 @Test fun `test switcher creates a new identity session`() {
   val s=TestUserSwitcher()
   val mike=s.switchTo(UserId("mike")); val paige=s.switchTo(UserId("paige"))
   assertNotEquals(mike.sessionId,paige.sessionId); assertEquals(UserId("paige"),s.current()?.userId)
 }
}
