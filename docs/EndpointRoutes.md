# Endpoint routes

## POST /endpoint/register
Registers an endpoint to a backend.

### Body

If the endpoint hasn't yet received an ID from the backend, the body should be left empty.

If the endpoint has received an ID from the backend it should be supplied in the body.

```json
{
    "endpointId": "ENDPOINTID"
}
```

### Response

**201** The endpoint is waiting to be authorized. The response body looks like
```json
{
    "endpointId": "ENDPOINTID"
}
```
If the endpoint hasn't yet saved the returned ID, it can be accessed through the response body.

**200** The endpoint is authorized and ready to join a course. The available courses can be accessed through the response body.
```json
{
    "someCourseId": {
        "courseName": "Some course name"
    },

    "anotherCourseId": {
        "courseName": "Another course name"
    }
}
```
Note that the JSON object keys determine the course ID and might not resemble the example.

**401** The endpoint is blocked or unregistered.

---

## POST /endpoint/join

Used to join a course that the endpoint will send status updates to.

### Body

```json
{
    "endpointId": "ENDPOINTID",
    "courseId": "COURSEID"
}
```

### Response

**200** The endpoint is authorized and can access the course. The endpoint can now send status updates to the selected course.

**403** The endpoint isn't authorized to access the selected course.

**401** The endpoint is blocked or unregistered.

---

## POST /endpoint/memberPresent

Used to indicate that the endpoint has detected a tag of a member.

## Body

```json
{
    "endpointId": "ENDPOINTID",
    "memberTag": "MEMBERTAG"
}
```

## Response

**200** The endpoint is authorized and can access the course. The server returns the member name which can be accessed from the response body.
```json
{
    "memberName": "MEMBERNAME"
}
```

**202** The endpoint is authorized and can access the course, but the user associated with the tag is not part of the current course.

**404** The value specified by `memberTag` is not recognized by the backend. The endpoint can register a new member.

**403** The endpoint isn't authorized to access the selected course.

**401** The endpoint is blocked or unregistered.

---

## POST /endpoint/registerMember

Used to register a new member that's associated with a tag.

## Body

```json
{
    "memberName": "MEMBERNAME",
    "memberTag": "MEMBERTAG",
    "memberId": "MEMBERID",
}
```

## Response

**201** A new member was registered succesfully.

**403** There was an error while registering the new member. Upon an error the response body will contain a field that tells which field is already in use.

```json
{
    "invalidField": "FIELD"
}
```
Possible values for `invalidField`:
- **`id`**: The supplied ID is already used.
- **`tag`**: The supplied tag is already used.

**401** The endpoint is blocked or unregistered.