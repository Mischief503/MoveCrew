package com.movecrew.communications
import com.movecrew.domain.*
import java.time.Instant
@JvmInline value class ConversationId(val value:String)
enum class ConversationType{DIRECT,GROUP,COMPANY}
data class Conversation(val id:ConversationId,val companyId:CompanyId,val type:ConversationType,val name:String?,val memberIds:Set<UserId>)
data class ChatMessage(val id:String,val conversationId:ConversationId,val senderId:UserId,val body:String,val sentAt:Instant,val editedAt:Instant?=null)
class ChatService{
 private val messages=mutableMapOf<ConversationId,MutableList<ChatMessage>>();private val ids=mutableSetOf<String>()
 @Synchronized fun send(c:Conversation,m:ChatMessage):Boolean{
  require(m.conversationId==c.id);require(m.senderId in c.memberIds){"Sender is not a conversation member"};require(m.body.isNotBlank())
  if(!ids.add(m.id))return false;messages.getOrPut(c.id){mutableListOf()}+=m;return true
 }
 fun history(c:Conversation,viewer:UserId):List<ChatMessage>{require(viewer in c.memberIds){"Viewer is not a conversation member"};return messages[c.id]?.toList()?:emptyList()}
}
enum class NotificationKind{JOB_ASSIGNMENT,JOB_CHANGE,MESSAGE,PAYROLL_READY,INVENTORY_LOW,VEHICLE_SAFETY_HOLD,SYSTEM}
data class Notification(val id:String,val companyId:CompanyId,val recipient:UserId,val kind:NotificationKind,val title:String,val body:String,val createdAt:Instant,val readAt:Instant?=null)
