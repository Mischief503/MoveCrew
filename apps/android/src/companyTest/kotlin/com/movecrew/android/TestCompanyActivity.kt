package com.movecrew.android

import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import android.widget.TextView
import com.movecrew.testsupport.FakeCompany
import com.movecrew.testsupport.TestUserSwitcher

/** Test-only launcher. This source set is absent from productionRelease. */
class TestCompanyActivity : MainActivity() {
    private lateinit var switcher: TestUserSwitcher

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        switcher = TestUserSwitcher()

        heading("Test Company — User Switcher")
        val people = FakeCompany.users
        val spinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@TestCompanyActivity,
                android.R.layout.simple_spinner_dropdown_item,
                people.map { "${it.identity.displayName} — ${it.role}" }
            )
        }
        content.addView(spinner)

        val status = TextView(this).apply { text = "Select an artificial employee, then switch." }
        content.addView(status)
        content.addView(Button(this).apply {
            text = "Switch Test Identity"
            isEnabled = people.isNotEmpty()
            setOnClickListener {
                val index = spinner.selectedItemPosition
                if (index in people.indices) {
                    val person = people[index]
                    val session = switcher.switchTo(person.identity.id)
                    status.text = "Viewing as ${person.identity.displayName} (${person.role}) • ${session.sessionId.take(8)}…"
                }
            }
        })
        text("TEST BUILD ONLY — absent from productionRelease.", 14f)
    }
}
