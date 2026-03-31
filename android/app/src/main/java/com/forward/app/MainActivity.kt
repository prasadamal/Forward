package com.forward.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import java.net.URLEncoder

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    // Convert ACTION_SEND (share intent) to the "picker" deep link
    convertShareIntent(intent, "picker")
    super.onCreate(null)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    if (intent != null) {
      convertShareIntent(intent, "picker")
      setIntent(intent)
    }
  }

  /**
   * If the intent is an ACTION_SEND with text, replace its data with a
   * forward://share deep link so the JS side can navigate to ShareReceivedScreen.
   */
  private fun convertShareIntent(intent: Intent, mode: String) {
    if (intent.action == Intent.ACTION_SEND) {
      val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
      val encoded = URLEncoder.encode(sharedText, "UTF-8")
      intent.action = Intent.ACTION_VIEW
      intent.data = Uri.parse("forward://share?text=$encoded&mode=$mode")
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled
      ) {}
    )
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
