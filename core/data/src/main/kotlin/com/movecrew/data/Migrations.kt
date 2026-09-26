package com.movecrew.data
data class SchemaVersion(val value:Int){init{require(value>=1)}}
interface MigrationDatabase{var schemaVersion:SchemaVersion;fun execute(statement:String)}
interface Migration{val from:SchemaVersion;val to:SchemaVersion;fun migrate(db:MigrationDatabase)}
class MigrationRunner(private val migrations:List<Migration>){fun migrate(db:MigrationDatabase,target:SchemaVersion){while(db.schemaVersion.value<target.value){val m=migrations.singleOrNull{it.from==db.schemaVersion}?:error("Missing migration from schema ${db.schemaVersion.value}");require(m.to.value==m.from.value+1);m.migrate(db);db.schemaVersion=m.to};require(db.schemaVersion==target)}}
