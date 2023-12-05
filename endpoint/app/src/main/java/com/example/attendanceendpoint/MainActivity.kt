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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme.typography
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
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
                val stream = if(responseCode <= 399) inputStream else errorStream

                stream.bufferedReader().use {
                    it.lines().forEach { line ->
                        result += line
                    }
                }
            } catch(err: FileNotFoundException) {
                println("Error during receiving $err")
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

    fun transition(before: @Composable() () -> Unit, after: @Composable() () -> Unit, millis: Long) {
        setContent {
            before()

            Handler().postDelayed(
                {
                    setContent {
                        after()
                    }
                }, millis
            )
        }
    }

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
                        transition(
                            before = { CenteredText("Hello ${json.getString("userName")}") },
                            after = { StandbyMode() },
                            2000
                        )
                    }

                    202 -> {
                        transition(
                            before = { CenteredText("You are not on this course") },
                            after = { StandbyMode() },
                            2000
                        )
                    }

                    401 -> {
                        transition(
                            before = { CenteredText("Endpoint is blocked") },
                            after = { StandbyMode() },
                            2000
                        )
                    }

                    404 -> {
                        // Temporarily disable tag handling while registration is happening.
                        readyForTags = false

                        setContent {
                            HandleRegistration() { memberName, memberId, errorCallback ->
                                println("Register $memberName $memberId $st")
                                val json = """
                                {
                                    "endpointId" : "${prefs.getString("EndpointID", "")}",
                                    "memberTag": "$st",
                                    "memberName": "$memberName",
                                    "memberId": "$memberId"
                                }
                                """

                                sendPostRequest("$address/endpoint/registerMember", json) { http, result ->
                                    when(http.responseCode) {
                                        // "201 Created" indicates that the registration was successful.
                                        201 -> {
                                            // TODO: Ask if member should be added to the current course?
                                            // TODO: Retry the memberPresent request?
                                            startAcceptingTags()
                                        }

                                        // "403 Forbidden" indicates that the ID or tag was invalid.
                                        403 -> {
                                            val json = JSONObject(result)

                                            when(json.getString("invalidField")) {
                                                "id" -> {
                                                    errorCallback("ID is already in use")
                                                }

                                                "tag" -> {
                                                    errorCallback("Tag is already in use")
                                                }
                                            }
                                        }

                                        401 -> {
                                            transition(
                                                before = { CenteredText("Endpoint is blocked") },
                                                after = { (LocalContext.current as MainActivity).startAcceptingTags() },
                                                2000
                                            )
                                        }
                                    }
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
fun HandleRegistration(callback: (String, String, (String) -> Unit) -> Unit) {
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
fun ShowRegistration(callback: (String, String, (String) -> Unit) -> Unit) {
    var memberName by remember { mutableStateOf("") }
    var memberId by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }

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
            callback(memberName, memberId) {
                error = it
            }
        }) {
            Text("Register")
        }

        Text(error)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfigureConnection() {
    val context = LocalContext.current
    val prefs = context.getSharedPreferences("ConfigurationPreferences", 0)
    val default : String = prefs.getString("ServerAddress", "")!!

    var text by remember { mutableStateOf(default) }

    Centered {
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
                if (prefs.contains("EndpointID")) {
                    json = """
                {
                    "endpointId" : "${prefs.getString("EndpointID", "")}"
                }
                """.trimIndent()
                }

                sendPostRequest("$text/endpoint/register", json) { http, result ->
                    println("Got response ${http.responseCode}")

                    when (http.responseCode) {
                        401 -> {
                            (context as MainActivity).transition(
                                before = { CenteredText("Endpoint is blocked") },
                                after = { ConfigureConnection() },
                                2000
                            )
                        }

                        // "201 Created" indicates that this endpoint now waits for authorization.
                        201 -> {
                            val json = JSONObject(result)

                            editor.putString("EndpointID", json.getString("endpointId"));
                            editor.apply();

                            (context as MainActivity).transition(
                                before = { CenteredText("Waiting to be authorized") },
                                after = { ConfigureConnection() },
                                2000
                            )
                        }

                        // "200 OK" indicates that this endpoint is ready to join a course.
                        200 -> {
                            val json = JSONObject(result)

                            val activity = context as MainActivity
                            activity.setContent {
                                ConfigureCourse(json.getJSONObject("availableCourses"))
                            }
                        }
                    }
                }

            }) {
                Text("Connect to the server")
            }
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

    Centered {
        if (courseNames.isEmpty()) {
            (LocalContext.current as MainActivity).transition(
                before = { CenteredText("No courses available") },
                after = { ConfigureConnection() },
                3000
            )
            
            return@Centered
        }

        var selectedId: String? = null

        Column {
            ShowDropDownMenu(courseNames, "Select a course") { item, index ->
                courses.keys().withIndex().forEach {
                    if (it.index == index) {
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
                    when (http.responseCode) {
                        // If the endpoint successfully joins a course, start accepting NFC tags.
                        200 -> {
                            (context as MainActivity).startAcceptingTags()
                        }

                        403 -> {
                            (context as MainActivity).transition(
                                before = { CenteredText("Endpoint isn't authorized for this course") },
                                after = { ConfigureConnection() },
                                2000
                            )
                        }

                        401 -> {
                            (context as MainActivity).transition(
                                before = { CenteredText("Endpoint isn't authorized") },
                                after = { ConfigureConnection() },
                                2000
                            )
                        }
                    }
                }
            }) {
                Text("Join course")
            }
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
fun StandbyMode() {
    Centered {
        LargeText("Scan your NFC tag")
    }
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
    Centered {
        LargeText(reason)
    }
}

@Composable
fun Centered(content: @Composable() () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

@Composable
fun CenteredText(text: String) {
    Centered {
        LargeText(text = text)
    }
}