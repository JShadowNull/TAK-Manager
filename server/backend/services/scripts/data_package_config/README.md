# Data Package Configuration Guide

## Frontend Request Format

The frontend sends a JSON request in the following format:

```json
{
  "takServerConfig": {
    "count": "1",
    "description0": "reaper",
    "ipAddress0": "192.168.1.1",
    "port0": "8090",
    "protocol0": "ssl",
    "caLocation0": "cert/truststore-intermediate.p12",
    "certPassword0": "atakatak"
  },
  "atakPreferences": {
    "team_color_gps_icon": "true"
  },
  "clientCert": "cert/jake.p12",
  "zipFileName": "jake"
}
```

## How Data Maps to Package Files

### 1. Initial Preferences (initial.pref)

The data is mapped to create an XML file with the following structure:

```xml
<?xml version="1.0" standalone="yes"?>
<preferences>
  <preference name="cot_streams" version="1">
    <entry key="count" class="class java.lang.Integer">(count)</entry>
    <entry key="description0" class="class java.lang.String">(description0)</entry>
    <entry key="enabled0" class="class java.lang.Boolean">True</entry>
    <entry key="connectString0" class="class java.lang.String">(ipAddress0):(port0):(protocol0)</entry>
    <entry key="caLocation0" class="class java.lang.String">(caLocation0)</entry>
    <entry key="certificateLocation0" class="class java.lang.String">(clientCert)</entry>
    <entry key="clientPassword0" class="class java.lang.String">(certPassword0)</entry>
    <entry key="caPassword0" class="class java.lang.String">(certPassword0)</entry>
  </preference>
  <!-- ATAK preferences are added here -->
  <preference name="com.atakmap.app.civ_preferences" version="1"/>
  <entry key="team_color_gps_icon" class="class java.lang.Boolean">true</entry>
</preferences>
```

### 2. Manifest File (manifest.xml)

The manifest file is created using this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<MissionPackageManifest version="2">
  <Configuration>
    <Parameter name="uid" value="[generated-uid]"/>
    <Parameter name="name" value="(zipFileName).zip"/>
    <Parameter name="onReceiveDelete" value="true"/>
  </Configuration>
  <Contents>
    <Content ignore="false" zipEntry="(caLocation0)"/>
    <Content ignore="false" zipEntry="(clientCert)"/>
    <Content ignore="false" zipEntry="initial.pref"/>
  </Contents>
</MissionPackageManifest>
```

## Important Notes

1. Certificate paths:
   - All certificate paths should start with `cert/`
   - The backend will handle stripping this prefix when needed

2. Passwords:
   - `certPassword0` is used for both client and CA certificates
   - The same password is set for `clientPassword0` and `caPassword0`

3. File structure:
   ```
   cert/
     ├── [client-cert].p12
     └── truststore-intermediate.p12
   initial.pref
   MANIFEST
     └── manifest.xml
   ```

4. Multiple Streams:
   - For multiple streams, increment the index (0, 1, 2, etc.)
   - Update the `count` field accordingly 


   [Debug] [PackageGenerator] Sending request data: (PackageGenerator.tsx, line 195)
"{
  \"takServerConfig\": {
    \"count\": \"2\",
    \"description0\": \"reaper\",
    \"ipAddress0\": \"192.168.1.1\",
    \"port0\": \"8090\",
    \"protocol0\": \"ssl\",
    \"caLocation0\": \"cert/truststore-intermediate.p12\",
    \"certPassword0\": \"atakatak\",
    \"description1\": \"test\",
    \"ipAddress1\": \"192.168.0.1\",
    \"port1\": \"8089\",
    \"protocol1\": \"ssl\",
    \"caLocation1\": \"cert/ca.pem\",
    \"certPassword1\": \"testtest\"
  },
  \"atakPreferences\": {
    \"team_color_gps_icon\": \"true\"
  },
  \"clientCert\": \"cert/jake.p12\",
  \"zipFileName\": \"jake\"
}"


<?xml version="1.0" standalone="yes"?>
<preferences>
  <preference name="cot_streams" version="1">
    <entry key="count" class="class java.lang.Integer">(count)</entry>
    <entry key="description0" class="class java.lang.String">(description0)</entry>
    <entry key="enabled0" class="class java.lang.Boolean">True</entry>
    <entry key="connectString0" class="class java.lang.String">(ipAddress0):(port0):(protocol0)</entry>
    <entry key="caLocation0" class="class java.lang.String">(caLocation0)</entry>
    <entry key="certificateLocation0" class="class java.lang.String">(clientCert)</entry>
    <entry key="clientPassword0" class="class java.lang.String">(certPassword0)</entry>
    <entry key="caPassword0" class="class java.lang.String">(certPassword0)</entry>
    <entry key="description1" class="class java.lang.String">(description1)</entry>
    <entry key="enabled1" class="class java.lang.Boolean">True</entry>
    <entry key="connectString1" class="class java.lang.String">(ipAddress1):(port1):(protocol1)</entry>
    <entry key="caLocation1" class="class java.lang.String">(caLocation1)</entry>
    <entry key="certificateLocation1" class="class java.lang.String">(clientCert)</entry>
    <entry key="clientPassword1" class="class java.lang.String">(certPassword1)</entry>
    <entry key="caPassword1" class="class java.lang.String">(certPassword1)</entry>
  </preference>
  <!-- ATAK preferences are added here -->
  <preference name="com.atakmap.app.civ_preferences" version="1"/>
  <entry key="team_color_gps_icon" class="class java.lang.Boolean">true</entry>
</preferences>
```

### 2. Manifest File (manifest.xml)

The manifest file is created using this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<MissionPackageManifest version="2">
  <Configuration>
    <Parameter name="uid" value="[generated-uid]"/>
    <Parameter name="name" value="(zipFileName).zip"/>
    <Parameter name="onReceiveDelete" value="true"/>
  </Configuration>
  <Contents>
    <Content ignore="false" zipEntry="(caLocation0)"/>
    <Content ignore="false" zipEntry="(caLocation1)"/>
    <Content ignore="false" zipEntry="(clientCert)"/>
    <Content ignore="false" zipEntry="initial.pref"/>
  </Contents>
</MissionPackageManifest>