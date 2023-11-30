package com.example.attendanceendpoint

import android.app.PendingIntent
import android.content.Intent
import android.nfc.NfcAdapter
import android.os.Bundle
import android.os.Handler
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme.typography
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject
import java.io.FileNotFoundException
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

fun sendRequest(serverUrl: String, callback: (client: HttpURLConnection, result: String?) -> Unit) {
    val prefix = "https://"
    val url = URL(if(serverUrl.startsWith(prefix)) serverUrl else "$prefix$serverUrl")

    thread {
        with(url.openConnection() as HttpURLConnection) {
            callback.invoke(this, null)

            var result : String? = ""

            try {
                inputStream.bufferedReader().use {
                    it.lines().forEach { line ->
                        result += line
                    }
                }
            } catch(err: FileNotFoundException) {
                println(err)
            }

            callback.invoke(this, result)
        }
    }
}

fun sendGetRequest(serverUrl: String, callback: (client: HttpURLConnection) -> Unit) {
    sendRequest(serverUrl) { http, _ ->
        http.requestMethod = "GET"
    }
}

fun sendPostRequest(serverUrl: String, json: String, callback: (client: HttpURLConnection, result: String) -> Unit) {
    sendRequest(serverUrl) { http, result ->
        if(result == null) {
            http.requestMethod = "POST"
            http.setRequestProperty("Accept", "application/json")
            http.setRequestProperty("Content-Type", "application/json")
            http.doOutput = true

            val output = http.outputStream
            val writer = OutputStreamWriter(output, "UTF-8")

            writer.write(json)
            writer.flush()
            writer.close()

        } else {
            callback(http, result)
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
            ConfigureConnection()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)

        if(!readyForTags)
        {
            return
        }

        Log.i("STATUS", "Got intent")

        if (NfcAdapter.ACTION_TAG_DISCOVERED == intent?.action) {
            var st = ""
            val msg = intent.getByteArrayExtra(NfcAdapter.EXTRA_ID)
            if (msg != null) {
                st = msg.joinToString(separator = ":"){ eachByte -> "%02x".format(eachByte) }
            }

            val prefs = getSharedPreferences("ConfigurationPreferences", 0)
            val address : String = prefs.getString("ServerAddress", "")!!

            if(address.isEmpty()) {
                Log.e("STATUS", "Server address is empty")
                return
            }

            val json = """
            {
                "endpointId" : "${prefs.getString("EndpointID", "")}",
                "tag": "$st"
            }
            """.trimIndent()

            sendPostRequest("$address/endpoint/setUserState", json) { http, result ->
                if(http.responseCode == 200) {
                    val json = JSONObject(result)

                    setContent {
                        stateChanged("Hello ${json.getString("userName")}")

                        Handler().postDelayed(
                        {
                            setContent {
                                StandbyMode()
                            }
                        }, 2000)
                    }
                }
            }

            //setContent {
            //    TagDetected(st)
            //}
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

    fun startAcceptingTags() {
        readyForTags = true

        setContent {
            StandbyMode()
        }
    }

    private var readyForTags = false
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfigureConnection() {
    val context = LocalContext.current
    val prefs = context.getSharedPreferences("ConfigurationPreferences", 0)
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

            var json = "{}"

            // If an ID is already stored, send it to the backend.
            if(prefs.contains("EndpointID"))
            {
                json = """
                {
                    "endpointId" : "${prefs.getString("EndpointID", "")}"
                }
                """.trimIndent()
            }

            sendPostRequest("$text/endpoint/register", json) { http, result ->
                println("Got response ${http.responseCode}")

                when(http.responseCode) {
                    // "401 Unauthorized" indicates that this endpoint is blocked.
                    401 -> {
                        // TODO: Visually show blocked state.
                        println("I am blocked :-(")
                    }

                    // "201 Created" indicates that this endpoint now waits for authorization.
                    201 -> {
                        val json = JSONObject(result)

                        editor.putString("EndpointID", json.getString("endpointId"));
                        editor.apply();

                        // TODO: Visually show waiting state.
                        println("I am waiting!")
                    }

                    // "200 OK" indicates that this endpoint is ready to join a course.
                    200 -> {
                        val json = JSONObject(result)

                        val activity = context as MainActivity
                        activity.setContent {
                            ConfigureCourse(json.getJSONObject("availableCourses"))
                        }

                        //activity.startAcceptingTags()
                    }
                }
            }

        }) {
            Text("Connect to the server")
        }
    }
}

@Composable
fun ConfigureCourse(courses: JSONObject) {
    val context = LocalContext.current
    var ids = mutableListOf<String>()

    for(key in courses.keys()) {
        ids.add(key)
    }

    if(ids.isEmpty()) {
        Text("No courses available")
        return
    }

    var selected = ids[0]

    Column {
        ShowDropDownMenu(ids) {
            println("Selected is now $it")
            selected = it
        }

        Button(onClick = {
            val prefs = context.getSharedPreferences("ConfigurationPreferences", 0)
            val address: String = prefs.getString("ServerAddress", "")!!

            if (address.isEmpty()) {
                Log.e("STATUS", "Server address is empty")
                return@Button
            }

            val json = """
            {
                "endpointId" : "${prefs.getString("EndpointID", "")}",
                "courseId": "$selected"
            }
            """.trimIndent()

            sendPostRequest("$address/endpoint/join", json) { http, result ->
            }
        }) {
            Text("Join course")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShowDropDownMenu(strings: List<String>, onSelected: (String) -> Unit) {
    val context = LocalContext.current
    var expanded by remember { mutableStateOf(false) }
    var selectedText by remember { mutableStateOf(strings[0]) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(32.dp)
    ) {
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = {
                expanded = !expanded
            }
        ) {
            TextField(
                value = selectedText,
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier.menuAnchor()
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                strings.forEach { item ->
                    DropdownMenuItem(
                        text = { Text(text = item) },
                        onClick = {
                            selectedText = item
                            expanded = false
                            onSelected(item)
                            Toast.makeText(context, item, Toast.LENGTH_SHORT).show()
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun stateChanged(newState: String) {
    LargeText(newState)
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