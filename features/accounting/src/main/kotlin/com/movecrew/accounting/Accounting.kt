package com.movecrew.accounting
import com.movecrew.domain.*
import java.time.*
@JvmInline value class AccountId(val value:String)
enum class AccountType{ASSET,LIABILITY,EQUITY,REVENUE,EXPENSE}
enum class EntrySide{DEBIT,CREDIT}
data class Account(val id:AccountId,val companyId:CompanyId,val code:String,val name:String,val type:AccountType)
data class JournalLine(val accountId:AccountId,val side:EntrySide,val amount:Money){init{require(amount.cents>0)}}
data class JournalEntry(val id:String,val companyId:CompanyId,val occurredAt:Instant,val memo:String,val lines:List<JournalLine>,val sourceKey:String)
class Ledger{
 private val entries=linkedMapOf<String,JournalEntry>();private val sources=mutableSetOf<String>()
 @Synchronized fun post(e:JournalEntry):Boolean{
  require(e.lines.size>=2);val d=e.lines.filter{it.side==EntrySide.DEBIT}.sumOf{it.amount.cents};val c=e.lines.filter{it.side==EntrySide.CREDIT}.sumOf{it.amount.cents}
  require(d==c){"Journal entry must balance"};if(!sources.add(e.sourceKey))return false;entries[e.id]=e;return true
 }
 fun all(companyId:CompanyId)=entries.values.filter{it.companyId==companyId}
}
data class BankTransaction(val id:String,val amount:Money,val postedOn:LocalDate)
data class Reconciliation(val statementEnding:Money,val ledgerEnding:Money,val difference:Money,val reconciled:Boolean)
class BankReconciler{fun reconcile(statement:Money,ledger:Money)=Reconciliation(statement,ledger,Money.cents(statement.cents-ledger.cents),statement==ledger)}
