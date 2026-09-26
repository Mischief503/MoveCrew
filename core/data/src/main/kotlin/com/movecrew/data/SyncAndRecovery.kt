package com.movecrew.data
import com.movecrew.domain.CompanyId
import java.security.MessageDigest
data class RemoteOperationResult(val operationId:String,val accepted:Boolean)
interface SyncTransport{fun push(operation:OutboxOperation):RemoteOperationResult}
class SyncEngine(private val outbox:OutboxStore,private val transport:SyncTransport){fun sync(companyId:CompanyId)=outbox.pending(companyId).map{op->transport.push(op).also{if(it.accepted)outbox.complete(op.id)}}}
object Integrity{fun sha256(bytes:ByteArray)=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)};fun verify(bytes:ByteArray,expected:String)=sha256(bytes).equals(expected,true)}
