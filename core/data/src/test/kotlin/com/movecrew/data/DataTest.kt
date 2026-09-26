package com.movecrew.data
import com.movecrew.domain.*
import java.time.Instant
import kotlin.test.*
private data class Row(override val companyId:CompanyId,override val id:String,val value:String):CompanyScopedEntity
class DataTest{
 @Test fun tenantIsolation(){val r=InMemoryCompanyRepository<Row>();val a=CompanyId("a");val b=CompanyId("b");r.upsert(a,Row(a,"1","ok"));assertNotNull(r.get(a,"1"));assertNull(r.get(b,"1"));assertFails{r.upsert(a,Row(b,"2","bad"))}}
 @Test fun idempotentOutbox(){val o=OutboxStore();val op=OutboxOperation("x",CompanyId("a"),UserId("u"),"PAYMENT","p",OperationType.POST,Instant.EPOCH,"{}");assertTrue(o.enqueue(op));assertFalse(o.enqueue(op));assertEquals(1,o.pending(CompanyId("a")).size)}
 @Test fun conflicts(){assertEquals(ConflictType.FINANCIAL,ConflictRules.classify("PAYMENT"));assertEquals(ConflictType.PHYSICAL_CUSTODY,ConflictRules.classify("VEHICLE_CUSTODY"))}
 @Test fun integrity(){val b="MoveCrew".encodeToByteArray();val h=Integrity.sha256(b);assertTrue(Integrity.verify(b,h));assertFalse(Integrity.verify("bad".encodeToByteArray(),h))}}
