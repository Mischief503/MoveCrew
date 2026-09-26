package com.movecrew.sales
import com.movecrew.domain.CompanyId
interface CustomerRepository{fun save(customer:Customer);fun get(companyId:CompanyId,id:CustomerId):Customer?}
interface EstimateRepository{fun save(estimate:Estimate);fun get(companyId:CompanyId,id:EstimateId):Estimate?}
class MemoryCustomerRepository:CustomerRepository{
 private val rows=mutableMapOf<Pair<CompanyId,CustomerId>,Customer>()
 override fun save(customer:Customer){rows[customer.companyId to customer.id]=customer}
 override fun get(companyId:CompanyId,id:CustomerId)=rows[companyId to id]
}
class MemoryEstimateRepository:EstimateRepository{
 private val rows=mutableMapOf<Pair<CompanyId,EstimateId>,Estimate>()
 override fun save(estimate:Estimate){rows[estimate.companyId to estimate.id]=estimate}
 override fun get(companyId:CompanyId,id:EstimateId)=rows[companyId to id]
}
