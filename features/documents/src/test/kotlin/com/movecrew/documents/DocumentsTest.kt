package com.movecrew.documents
import java.time.Instant
import kotlin.test.*
class DocumentsTest{
 @Test fun `csv quotes commas and quotes`(){
  val csv=CsvExporter.rows(listOf("name","note"),listOf(listOf("Smith, Jane","said \"hi\"")))
  assertTrue(csv.contains("\"Smith, Jane\""));assertTrue(csv.contains("\"said \"\"hi\"\"\""))
 }
 @Test fun `backup validates then detects corruption`(){
  val s=BackupService();val b=s.create(1,"1.0","payload".encodeToByteArray(),Instant.EPOCH);s.validate(b,1)
  assertFails{s.validate(b.copy(payload="changed".encodeToByteArray()),1)}
 }
 @Test fun `newer backup schema refuses unsafe restore`(){
  val s=BackupService();val b=s.create(9,"future","x".encodeToByteArray(),Instant.EPOCH)
  assertFails{s.validate(b,8)}
 }}
