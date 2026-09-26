package com.movecrew.documents
import com.movecrew.domain.*
import com.movecrew.data.Integrity
import java.time.Instant
enum class DocumentType{ESTIMATE,WORK_ORDER,INVOICE,RECEIPT,PAYROLL_REPORT,ACCOUNTING_REPORT,JOB_REPORT,AUDIT_EXPORT}
data class DocumentArtifact(val id:String,val companyId:CompanyId,val type:DocumentType,val version:Int,val mediaType:String,val bytes:ByteArray,val createdAt:Instant){
 val sha256:String get()=Integrity.sha256(bytes)
}
interface PdfRenderer{fun render(type:DocumentType,title:String,fields:Map<String,String>):ByteArray}
object CsvExporter{
 fun rows(headers:List<String>,rows:List<List<String>>):String{
  require(rows.all{it.size==headers.size})
  fun q(v:String)="\""+v.replace("\"","\"\"")+"\""
  return (listOf(headers)+rows).joinToString("\n"){r->r.joinToString(","){q(it)}}+"\n"
 }}
data class BackupBundle(val schemaVersion:Int,val appVersion:String,val payload:ByteArray,val sha256:String,val createdAt:Instant)
class BackupService{
 fun create(schema:Int,appVersion:String,payload:ByteArray,at:Instant)=BackupBundle(schema,appVersion,payload,Integrity.sha256(payload),at)
 fun validate(bundle:BackupBundle,supportedSchema:Int){require(bundle.schemaVersion<=supportedSchema){"Backup schema is newer than application"};require(Integrity.verify(bundle.payload,bundle.sha256)){"Backup integrity failure"}}
}
data class AuditExportRow(val eventId:String,val actor:String,val eventType:String,val occurredAt:String,val subjectId:String?)
object AuditCsv{
 fun export(rows:List<AuditExportRow>)=CsvExporter.rows(listOf("event_id","actor","event_type","occurred_at","subject_id"),rows.map{listOf(it.eventId,it.actor,it.eventType,it.occurredAt,it.subjectId?:"")})
}
