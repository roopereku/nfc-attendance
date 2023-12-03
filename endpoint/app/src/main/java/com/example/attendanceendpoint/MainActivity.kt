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
                "memberTag": "$st"
            }
            """.trimIndent()

            sendPostRequest("$address/endpoint/memberPresent", json) { http, result ->
                when(http.responseCode) {
                    200 -> {
                        val json = JSONObject(result)

                        setContent {
                            stateChanged("Hello ${json.getString("userName")}")

                            Handler().postDelayed(
                                {
                                    setContent {
                                        StandbyMode()
                                    }
                                }, 2000
                            )
                        }
                    }

                    404 -> {
                        // Temporarily disable tag handling while registration is happening.
                        readyForTags = false

                        setContent {
                            HandleRegistration() { memberName, memberId ->
                                println("Register $memberName $memberId $st")

                                sendPostRequest("$address/endpoint/registerMember", json) { http, result ->
                                    println("Register member returned ${http.responseCode}")
                                }
                            }
                        }
                    }
                }
            }
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

@Composable
fun HandleRegistration(callback: (String, String) -> Unit) {
    val context = LocalContext.current

    Column {
        Text("Tag is not recognized. Do you want to register it?")

        Button(onClick = {
            (context as MainActivity).setContent {
                ShowRegistration(callback)
            }
        }) {
            Text("Yes")
        }

        Button(onClick = {
            (context as MainActivity).startAcceptingTags()
        }) {
            Text("No")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShowRegistration(callback: (String, String) -> Unit) {
    var memberName by remember { mutableStateOf("") }
    var memberId by remember { mutableStateOf("") }

    Column {
        OutlinedTextField(
            value = memberName,
            onValueChange = { memberName = it },
            label = { Text("Your name") }
        )

        OutlinedTextField(
            value = memberId,
            onValueChange = { memberId = it },
            label = { Text("Your student ID") }
        )

        Button(onClick = {
            callback(memberName, memberId)
        }) {
            Text("Register")
        }
    }
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
    var courseNames = mutableListOf<String>()

    for(key in courses.keys()) {
        val courseData = JSONObject(courses[key].toString())
        courseNames.add("${courseData.getString("courseName")} ($key)")
    }

    if(courseNames.isEmpty()) {
        Text("No courses available")
        return
    }

    var selectedId: String? = null

    Column {
        ShowDropDownMenu(courseNames, "Select a course") { item, index ->
            courses.keys().withIndex().forEach {
                if(it.index == index)
                {
                    selectedId = it.value
                }
            }
        }

        Button(onClick = {
            val prefs = context.getSharedPreferences("ConfigurationPreferences", 0)
            val address: String = prefs.getString("ServerAddress", "")!!

            if (address.isEmpty()) {
                Log.e("STATUS", "Server address is empty")
                return@Button
            }

            if (selectedId == null) {
                Log.e("STATUS", "No course selected")
                return@Button
            }

            val json = """
            {
                "endpointId" : "${prefs.getString("EndpointID", "")}",
                "courseId": "$selectedId"
            }
            """.trimIndent()

            sendPostRequest("$address/endpoint/join", json) { http, result ->
                when(http.responseCode) {
                    // If the endpoint successfully joins a course, start accepting NFC tags.
                    200 -> {
                        (context as MainActivity).startAcceptingTags()
                    }

                    403 -> {
                        // TODO: Tell user that this endpoint isn't authorized for course.
                        println("Not authorized to course")
                    }

                    401 -> {
                        // TODO: Tell user that this endpoint isn't authorized.
                        println("Not authorized when joining a course")
                    }
                }
            }
        }) {
            Text("Join course")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShowDropDownMenu(strings: List<String>, initial: String, onSelected: (String, Int) -> Unit) {
    val context = LocalContext.current
    var expanded by remember { mutableStateOf(false) }
    var selectedText by remember { mutableStateOf(initial) }

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
                strings.forEachIndexed() { index, item ->
                    DropdownMenuItem(
                        text = { Text(text = item) },
                        onClick = {
                            selectedText = item
                            expanded = false
                            onSelected(item, index)
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