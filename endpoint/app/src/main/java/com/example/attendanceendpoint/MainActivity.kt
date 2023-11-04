package com.example.attendanceendpoint

import android.app.PendingIntent
import android.content.Intent
import android.nfc.NfcAdapter
import android.os.Bundle
import android.os.Handler
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme.typography
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.net.HttpURLConnection
import java.net.URL

fun sendGet(urlString: String) {
    val prefix = "https://"
    val url = URL(if(urlString.startsWith(prefix)) urlString else "$prefix$urlString")

    Log.i("HTTPS", "Send request to $url")

    with(url.openConnection() as HttpURLConnection) {
        requestMethod = "GET"  // optional default is GET

        Log.i("HTTPS", "\nSent 'GET' request to URL : $url; Response Code : $responseCode")

        inputStream.bufferedReader().use {
            it.lines().forEach { line ->
                Log.i("HTTPS LINE", line)
            }
        }
    }
}

class MainActivity : ComponentActivity() {
    private var nfc : NfcAdapter? = null

    private fun onAdapterInvalid() {
        if(nfc == null) {
            Log.e("NFC", "Adapter is null")

            setContent {
                InvalidAdapter("Unable to get NFC adapter")
            }
        }

        else {
            Log.e("NFC", "Adapter is disabled")

            setContent {
                InvalidAdapter(" NFC is disabled")
            }
        }
    }

    private fun onAdapterValid() {
        Log.i("NFC", "Adapter is valid")

        setContent {
            ConfigurationView()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)

        Log.i("STATUS", "Got intent")

        if (NfcAdapter.ACTION_TAG_DISCOVERED == intent?.action) {
            var st = ""
            val msg = intent.getByteArrayExtra(NfcAdapter.EXTRA_ID)
            if (msg != null) {
                st = msg.joinToString(separator = ":"){ eachByte -> "%02x".format(eachByte) }
            }

            setContent {
                TagDetected(st)
            }

            Handler().postDelayed({
                setContent {
                    StandbyMode()
                }
            }, 3000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        nfc = NfcAdapter.getDefaultAdapter(this)

        if (nfc != null) {
            if (nfc?.isEnabled == true)
                onAdapterValid()
            else onAdapterInvalid()
        } else onAdapterInvalid()

        val intent = Intent(this, javaClass).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

        pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_MUTABLE)
    }

    private var pendingIntent : PendingIntent? = null

    public override fun onPause() {
        super.onPause()
        nfc?.disableForegroundDispatch(this)
    }

    public override fun onResume() {
        super.onResume()
        nfc?.enableForegroundDispatch(this, pendingIntent, null, null)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfigurationView() {
    val prefs = LocalContext.current.getSharedPreferences("ConfigurationPreferences", 0)

    val default : String = prefs.getString("ServerAddress", "")!!
    var text by remember { mutableStateOf(default) }

    Column {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            label = { Text("Label") }
        )

        Button(onClick = {
            val editor = prefs.edit();
            editor.putString("ServerAddress", text);
            editor.apply();

            sendGet(text)
        }) {
            Text("Filled")
        }
    }
}

@Composable
fun TagDetected(serialNumber: String) {
    LargeText("Found tag $serialNumber")
}

@Composable
fun StandbyMode() {
    LargeText("Scan your NFC tag")
}

@Composable
fun LargeText(text: String) {
    Text(
        text = text,
        modifier = Modifier.padding(16.dp),
        textAlign = TextAlign.Center,
        style = typography.titleLarge
    )
}

@Composable
fun InvalidAdapter(reason: String) {
    LargeText(reason)
}