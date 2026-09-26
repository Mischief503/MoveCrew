package com.movecrew.closeout
import com.movecrew.domain.*
import com.movecrew.sales.JobId
import java.time.Instant
@JvmInline value class InvoiceId(val value:String)
data class SignaturePoint(val x:Float,val y:Float,val pressure:Float?=null)
data class CapturedSignature(val signerName:String,val points:List<SignaturePoint>,val signedAt:Instant,val documentVersion:Int){
 init{require(signerName.isNotBlank());require(points.size>=2);require(documentVersion>0)}
}
data class InvoiceLine(val code:String,val description:String,val quantity:Int,val unitPrice:Money){
 init{require(quantity>0)};val total get()=Money.cents(unitPrice.cents*quantity)}
enum class InvoiceStatus{DRAFT,READY,SIGNED,ISSUED,VOID}
data class Invoice(val id:InvoiceId,val companyId:CompanyId,val jobId:JobId,val version:Int,val lines:List<InvoiceLine>,val status:InvoiceStatus,val signature:CapturedSignature?=null){
 val total get()=lines.fold(Money.ZERO){a,l->a+l.total}
}
class InvoiceService{
 fun sign(invoice:Invoice,signature:CapturedSignature):Invoice{
  require(invoice.status==InvoiceStatus.READY);require(signature.documentVersion==invoice.version){"Signature must bind to exact invoice version"}
  return invoice.copy(status=InvoiceStatus.SIGNED,signature=signature)
 }
 fun revise(invoice:Invoice,newLines:List<InvoiceLine>)=invoice.copy(version=invoice.version+1,lines=newLines,status=InvoiceStatus.READY,signature=null)
}
