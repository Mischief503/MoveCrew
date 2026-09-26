package com.movecrew.communications
import com.movecrew.domain.*
import java.time.Instant
import kotlin.test.*
class ChatTest{
 @Test fun `non member cannot read private conversation`(){
  val c=Conversation(ConversationId("d"),CompanyId("c"),ConversationType.DIRECT,null,setOf(UserId("a"),UserId("b")))
  assertFails{ChatService().history(c,UserId("boss"))}
 }
 @Test fun `message retry is idempotent`(){
  val c=Conversation(ConversationId("d"),CompanyId("c"),ConversationType.DIRECT,null,setOf(UserId("a"),UserId("b")))
  val m=ChatMessage("m",c.id,UserId("a"),"hello",Instant.EPOCH);val s=ChatService()
  assertTrue(s.send(c,m));assertFalse(s.send(c,m));assertEquals(1,s.history(c,UserId("b")).size)
 }}
