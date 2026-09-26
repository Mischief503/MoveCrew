package com.movecrew.auth
import com.movecrew.domain.*

interface AuthenticationGateway {
    fun restoreSession():UserSession?
    fun logout()
}

class SessionManager(private val environment:AppEnvironment) {
    private var session:UserSession?=null
    fun current():UserSession?=session
    fun establish(value:UserSession){session=value}
    fun revoke(){session=null}
    fun environment()=environment
}
