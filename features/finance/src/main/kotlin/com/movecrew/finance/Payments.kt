package com.movecrew.finance
import com.movecrew.domain.*
import com.movecrew.closeout.InvoiceId
import java.time.Instant
@JvmInline value class PaymentId(val value:String)
enum class PaymentStatus{PENDING,AUTHORIZED,CAPTURED,FAILED,REFUNDED,VOID}
data class Payment(val id:PaymentId,val companyId:CompanyId,val invoiceId:InvoiceId,val amount:Money,val status:PaymentStatus,val providerReference:String?=null,val createdAt:Instant)
data class Refund(val id:String,val paymentId:PaymentId,val amount:Money,val providerReference:String,val createdAt:Instant)
interface PaymentGateway{fun capture(idempotencyKey:String,amount:Money):GatewayResult;fun refund(idempotencyKey:String,providerReference:String,amount:Money):GatewayResult}
data class GatewayResult(val confirmed:Boolean,val reference:String?,val message:String?)
class PaymentService(private val gateway:PaymentGateway){
 private val captures=mutableMapOf<String,Payment>()
 fun capture(key:String,draft:Payment):Payment{
  captures[key]?.let{return it}
  val r=gateway.capture(key,draft.amount)
  val result=if(r.confirmed&&r.reference!=null)draft.copy(status=PaymentStatus.CAPTURED,providerReference=r.reference) else draft.copy(status=PaymentStatus.FAILED)
  captures[key]=result;return result
 }}
class Receivables{fun balance(invoiceTotal:Money,captured:List<Payment>,refunds:List<Refund>):Money{
 val paid=captured.filter{it.status==PaymentStatus.CAPTURED}.sumOf{it.amount.cents};val refunded=refunds.sumOf{it.amount.cents}
 return Money.cents(invoiceTotal.cents-paid+refunded)
}}
