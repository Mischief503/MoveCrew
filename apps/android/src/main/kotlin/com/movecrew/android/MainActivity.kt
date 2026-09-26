package com.movecrew.android

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Deliberately dependency-light launcher Activity.
 * Domain/data modules must never be required just to put the first MoveCrew frame on screen.
 */
open class MainActivity : Activity() {
    protected lateinit var content: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(36, 48, 36, 36)
        }
        val scroll = ScrollView(this).apply { addView(content) }
        setContentView(scroll)

        heading("MoveCrew")
        text("Moving-company operations • ${BuildConfig.APP_ENVIRONMENT}", 16f)
        text("Jobs  •  Dispatch  •  Customers  •  Time  •  Chat  •  Warehouse  •  Fleet  •  Accounting  •  Payroll  •  Reports  •  Settings", 15f)
        text("13 smooth themes are available. Private payroll/accounting access remains permission-scoped.", 14f)
    }

    protected fun heading(value: String) {
        content.addView(TextView(this).apply {
            text = value
            textSize = 26f
            gravity = Gravity.START
            setPadding(0, 8, 0, 16)
        })
    }

    protected fun text(value: String, size: Float) {
        content.addView(TextView(this).apply {
            text = value
            textSize = size
            setPadding(0, 8, 0, 8)
        })
    }
}
