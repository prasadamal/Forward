package com.forward.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * A lightweight trampoline Activity registered in the Android share sheet as
 * "Forward – Auto Add". It converts the shared text to a forward:// deep link
 * with mode=auto and hands off to MainActivity, then immediately finishes itself.
 */
class ShareActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: ""

        if (sharedText.isNotBlank()) {
            val encoded = Uri.encode(sharedText)
            val deepLink = "forward://share?text=$encoded&mode=auto"

            val mainIntent = Intent(this, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse(deepLink)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(mainIntent)
        }

        finish()
    }
}
