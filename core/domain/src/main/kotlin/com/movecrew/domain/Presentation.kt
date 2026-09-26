package com.movecrew.domain
data class MoveCrewTheme(val id:String,val displayName:String,val backgroundHex:String,val surfaceHex:String,val accentHex:String,val textHex:String)
object ThemeCatalog {
 val all=listOf(
 MoveCrewTheme("movecrew-blue","MoveCrew Blue","#F4F8FC","#FFFFFF","#246BFD","#132238"),
 MoveCrewTheme("midnight","Midnight","#111827","#1F2937","#60A5FA","#F9FAFB"),
 MoveCrewTheme("slate","Slate","#F1F5F9","#FFFFFF","#475569","#0F172A"),
 MoveCrewTheme("forest","Forest","#F3F8F4","#FFFFFF","#2F7D4A","#163020"),
 MoveCrewTheme("emerald","Emerald","#ECFDF5","#FFFFFF","#059669","#064E3B"),
 MoveCrewTheme("ocean","Ocean","#EFF8FF","#FFFFFF","#0284C7","#0C4A6E"),
 MoveCrewTheme("indigo","Indigo","#F5F3FF","#FFFFFF","#4F46E5","#312E81"),
 MoveCrewTheme("violet","Violet","#FAF5FF","#FFFFFF","#7C3AED","#4C1D95"),
 MoveCrewTheme("sunset","Sunset","#FFF7ED","#FFFFFF","#EA580C","#7C2D12"),
 MoveCrewTheme("sand","Sand","#FAF7F2","#FFFDF8","#A16207","#422006"),
 MoveCrewTheme("rose","Rose","#FFF1F2","#FFFFFF","#E11D48","#881337"),
 MoveCrewTheme("graphite","Graphite","#18181B","#27272A","#A1A1AA","#FAFAFA"),
 MoveCrewTheme("high-contrast","High Contrast","#000000","#111111","#FFD400","#FFFFFF"))
 fun require(id:String)=all.single{it.id==id}
}
enum class AppSection{HOME,JOBS,DISPATCH,CUSTOMERS,TIME,CHAT,WAREHOUSE,FLEET,ACCOUNTING,PAYROLL,REPORTS,SETTINGS}
object RoleNavigation {
 fun sections(roles:Set<CompanyRole>):Set<AppSection>{
  val r=linkedSetOf(AppSection.HOME,AppSection.JOBS,AppSection.TIME,AppSection.CHAT,AppSection.SETTINGS)
  if(CompanyRole.OWNER in roles||CompanyRole.OFFICE in roles)r+=AppSection.CUSTOMERS
  if(CompanyRole.OWNER in roles||CompanyRole.DISPATCHER in roles)r+=AppSection.DISPATCH
  if(CompanyRole.OWNER in roles||CompanyRole.WAREHOUSE in roles)r+=AppSection.WAREHOUSE
  if(CompanyRole.OWNER in roles||CompanyRole.FLEET in roles)r+=AppSection.FLEET
  if(CompanyRole.ACCOUNTING in roles)r+=AppSection.ACCOUNTING
  if(CompanyRole.PAYROLL in roles)r+=AppSection.PAYROLL
  if(CompanyRole.OWNER in roles||CompanyRole.ACCOUNTING in roles)r+=AppSection.REPORTS
  return r
 }}
