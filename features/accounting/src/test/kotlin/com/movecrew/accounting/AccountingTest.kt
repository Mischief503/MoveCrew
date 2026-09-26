package com.movecrew.accounting
import com.movecrew.domain.*
import java.time.Instant
import kotlin.test.*
class AccountingTest{
 @Test fun `journal must balance`(){
  val e=JournalEntry("e",CompanyId("c"),Instant.EPOCH,"sale",listOf(JournalLine(AccountId("cash"),EntrySide.DEBIT,Money.cents(100)),JournalLine(AccountId("rev"),EntrySide.CREDIT,Money.cents(100))),"invoice-1")
  assertTrue(Ledger().post(e))
 }
 @Test fun `unbalanced journal rejected`(){
  val e=JournalEntry("e",CompanyId("c"),Instant.EPOCH,"bad",listOf(JournalLine(AccountId("a"),EntrySide.DEBIT,Money.cents(100)),JournalLine(AccountId("b"),EntrySide.CREDIT,Money.cents(99))),"bad")
  assertFails{Ledger().post(e)}
 }
 @Test fun `same source cannot post twice`(){
  val l=Ledger();val e=JournalEntry("e",CompanyId("c"),Instant.EPOCH,"x",listOf(JournalLine(AccountId("a"),EntrySide.DEBIT,Money.cents(1)),JournalLine(AccountId("b"),EntrySide.CREDIT,Money.cents(1))),"same")
  assertTrue(l.post(e));assertFalse(l.post(e.copy(id="e2")))
 }}
