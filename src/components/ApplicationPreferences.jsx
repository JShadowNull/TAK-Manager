import React from 'react';
import PreferenceItem from './PreferenceItem';

export const APP_PREFERENCES = [
    {
        name: "Use team color for GPS icons",
        label: "team_color_gps_icon", 
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable notifications when other users are controlled",
        label: "atakControlOtherUserNotification",
        input_type: "checkbox", 
        checked: true
    },
    {
        name: "Show ETA (Estimated Time of Arrival) in RAB (Route and Bearing) preferences",
        label: "rab_preference_show_eta",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Minimum dynamic reporting rate for unreliable connections (in seconds)",
        label: "dynamicReportingRateMinUnreliable", 
        input_type: "text",
        value: "20"
    },
    {
        name: "Use WR (Wave Relay) callsign for location reporting",
        label: "locationUseWRCallsign",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Disable the EUD (End User Device) API option",
        label: "eud_api_disable_option",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable scanning for plugins on startup",
        label: "atakPluginScanningOnStartup",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Disable automatic linking of map item links",
        label: "disable_autolink_mapitem_links",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Scaling factor for relative overlays",
        label: "relativeOverlaysScalingRadioList",
        input_type: "text",
        value: "1.0"
    },
    {
        name: "Enable file sharing functionality",
        label: "filesharingEnabled",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Disable the file sharing preference item",
        label: "disablePreferenceItem_filesharingEnabled",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Hide dispatch location",
        label: "dispatchLocationHidden",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Show map zoom controls",
        label: "map_zoom_visible",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable logging to file",
        label: "loggingfile",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Toggle visibility of DPGK (Digital Precision Grid Kit) root",
        label: "dpgkRootVisibilityToggle",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Use custom color for GPS icons",
        label: "custom_color_gps_icon_pref",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Timeout for file sharing connections (in seconds)",
        label: "filesharingConnectionTimeoutSecs",
        input_type: "text",
        value: "10"
    },
    {
        name: "Display altitude as AGL (Above Ground Level)",
        label: "alt_display_agl",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Dim the map with the brightness key",
        label: "dim_map_with_brightness_key",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Ask for confirmation before quitting ATAK control",
        label: "atakControlAskToQuit",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Number of attempts to download files in file sharing",
        label: "fileshareDownloadAttempts",
        input_type: "text",
        value: "10"
    },
    {
        name: "Name of the imagery tab",
        label: "imagery_tab_name",
        input_type: "select",
        options: [
            {value: "Imagery", text: "Imagery"},
            {value: "Maps", text: "Maps"}
        ]
    },
    {
        name: "Port number for chat functionality",
        label: "chatPort",
        input_type: "text",
        value: "17012"
    },
    {
        name: "Disable the chat port preference item",
        label: "disablePreferenceItem_chatPort",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Scale factor for location markers",
        label: "location_marker_scale_key",
        input_type: "text",
        value: "-1"
    },
    {
        name: "Enable audible notifications",
        label: "audibleNotify",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable Bluetooth for ATAK control",
        label: "atakControlBluetooth",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Display range in feet",
        label: "rng_feet_display_pref",
        input_type: "text",
        value: "5280"
    },
    {
        name: "Enable toast notifications",
        label: "enableToast",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable developer tools",
        label: "atakDeveloperTools",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable automatic upload of logs",
        label: "enableAutoUploadLogs",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Reverse orientation for ATAK control",
        label: "atakControlReverseOrientation",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Only allow streaming with VPN enabled",
        label: "onlyStreamingWithVPN",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Altitude display preference (MSL - Mean Sea Level)",
        label: "alt_display_pref",
        input_type: "select",
        options: [
            {value: "MSL", text: "Mean Sea Level"},
            {value: "HAE", text: "Height Above Ellipsoid"}
        ]
    },
    {
        name: "Timeout for TCP connections (in seconds)",
        label: "tcpConnectTimeout",
        input_type: "text",
        value: "20"
    },
    {
        name: "Multicast address for chat functionality",
        label: "chatAddress",
        input_type: "text",
        value: "224.10.10.1"
    },
    {
        name: "Disable the chat address preference item",
        label: "disablePreferenceItem_chatAddress",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Timeout for file sharing transfers (in seconds)",
        label: "filesharingTransferTimeoutSecs",
        input_type: "text",
        value: "10"
    },
    {
        name: "Enable phone number in SA (Situational Awareness)",
        label: "saHasPhoneNumber",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Tabs for coordinate entry",
        label: "coordinate_entry_tabs",
        input_type: "text",
        value: ""
    },
    {
        name: "Enable volume map switcher",
        label: "volumemapswitcher",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "RAB distance slant range preference",
        label: "rab_dist_slant_range",
        input_type: "text",
        value: "clamped"
    },
    {
        name: "Enable QUIC (Quick UDP Internet Connections) protocol",
        label: "network_quic_enabled",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable high-speed capability for PPP0 (Point-to-Point Protocol)",
        label: "ppp0_highspeed_capable",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable faux navigation bar",
        label: "faux_nav_bar",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable repository startup synchronization",
        label: "repoStartupSync",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Constant reporting rate for reliable connections (in seconds)",
        label: "constantReportingRateReliable",
        input_type: "text",
        value: "15"
    },
    {
        name: "Camera chooser for QuickPic application",
        label: "quickpic.camera_chooser",
        input_type: "select",
        options: [
            {value: "system", text: "System"},
            {value: "takgeocam", text: "TAK GeoCam"}
        ]
    },
    {
        name: "Display server connection widget",
        label: "displayServerConnectionWidget",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Port number for unsecure API server",
        label: "apiUnsecureServerPort",
        input_type: "text",
        value: "8080"
    },
    {
        name: "Disable the unsecure API server port preference item",
        label: "disablePreferenceItem_apiUnsecureServerPort",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Toggle visibility of GRG root",
        label: "grgRootVisibilityToggle",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Action for long press on map in ATAK",
        label: "atakLongPressMap",
        input_type: "text",
        value: "nothing"
    },
    {
        name: "Prefer alternate number for display",
        label: "preferAltNumber",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Timeout for UDP connections with no data (in seconds)",
        label: "udpNoDataTimeout",
        input_type: "text",
        value: "30"
    },
    {
        name: "Enable metrics collection",
        label: "collect_metrics",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Use default GPS icon",
        label: "default_gps_icon",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable dispatch location COT external at start",
        label: "dispatchLocationCotExternalAtStart",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Adjust curved display for ATAK",
        label: "atakAdjustCurvedDisplay",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Insert destination in directed CoT messages",
        label: "insertDestInDirectedCoT",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Shorten labels for ATAK control",
        label: "atakControlShortenLabels",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Port number for file sharing web server",
        label: "filesharingWebServerPort",
        input_type: "text",
        value: "8080"
    },
    {
        name: "Disable the file sharing web server port preference item",
        label: "disablePreferenceItem_filesharingWebServerPort",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Maximum dynamic reporting rate for reliable connections (in seconds)",
        label: "dynamicReportingRateMaxReliable",
        input_type: "text",
        value: "2"
    },
    {
        name: "Show labels for ATAK control",
        label: "atakControlShowLabels",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Quit ATAK control on back button press",
        label: "atakControlQuitOnBack",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable update server for app management",
        label: "appMgmtEnableUpdateServer",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Disable the app management update server preference item",
        label: "disablePreferenceItem_ppMgmtEnableUpdateServer",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable phone vibration",
        label: "vibratePhone",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Forced brightness level for ATAK",
        label: "atakForcedBrightness",
        input_type: "text",
        value: "-1"
    },
    {
        name: "Enable device profile on connect",
        label: "deviceProfileEnableOnConnect",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Disable the device profile on connect preference item",
        label: "disablePreferenceItem_deviceProfileEnableOnConnect",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Set domain preference (e.g., Ground, Air)",
        label: "set_domain_pref",
        input_type: "text",
        value: "Ground"
    },
    {
        name: "Text size for labels",
        label: "label_text_size",
        input_type: "text",
        value: "14"
    },
    {
        name: "Enable permissive mode for HTTP client",
        label: "httpClientPermissiveMode",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Port number for API certificate enrollment",
        label: "apiCertEnrollmentPort",
        input_type: "text",
        value: "8446"
    },
    {
        name: "Disable the API certificate enrollment port preference item",
        label: "disablePreferenceItem_apiCertEnrollmentPort",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable file sharing for all servers",
        label: "filesharingAllServers",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Disable the file sharing all servers preference item",
        label: "disablePreferenceItem_ilesharingAllServers",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable map scale rounding",
        label: "map_scale_rounding",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable real-time metrics",
        label: "realtime_metrics",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Range in meters display preference",
        label: "rng_meters_display_pref",
        input_type: "text",
        value: "2000"
    },
    {
        name: "Coordinate display preference (e.g., MGRS, UTM)",
        label: "coord_display_pref",
        input_type: "text",
        value: "MGRS"
    },
    {
        name: "Enable screen lock for ATAK",
        label: "atakScreenLock",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Show map eye altitude",
        label: "map_eyealt_visible",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable logging file upload for debugging",
        label: "loggingfile_upload_debug",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "RAB color preference",
        label: "rab_color_pref",
        input_type: "text",
        value: "red"
    },
    {
        name: "Layer outline color preference",
        label: "pref_layer_outline_color",
        input_type: "text",
        value: "#00ff00"
    },
    {
        name: "Show map center designator",
        label: "map_center_designator",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable right navigation orientation",
        label: "nav_orientation_right",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable smart cache",
        label: "prefs_enable_smart_cache",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable globe mode for ATAK",
        label: "atakGlobeModeEnabled",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Show TAK version number in dispatch",
        label: "dispatchTAKVersionNumber",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable certificate enrollment export",
        label: "certEnrollmentExport",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Disable the certificate enrollment export preference item",
        label: "disablePreferenceItem_certEnrollmentExport",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Auto-close tilt rotation menu",
        label: "tilt_rotation_menu_auto_close",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Center self on back button press",
        label: "atakBackButtonCenterSelf",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable legacy HTTP for file sharing web server",
        label: "filesharingWebServerLegacyHttpEnabled",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "File sharing size threshold for no-go (in MB)",
        label: "filesharingSizeThresholdNoGo",
        input_type: "text",
        value: "100"
    },
    {
        name: "Team color for location",
        label: "locationTeam",
        input_type: "select",
        options: [
            {value: "Blue", text: "Blue"},
            {value: "Dark Blue", text: "Dark Blue"},
            {value: "Cyan", text: "Cyan"},
            {value: "Teal", text: "Teal"},
            {value: "Green", text: "Green"},
            {value: "Dark Green", text: "Dark Green"},
            {value: "Red", text: "Red"},
            {value: "Orange", text: "Orange"},
            {value: "Yellow", text: "Yellow"},
            {value: "Brown", text: "Brown"},
            {value: "Magenta", text: "Magenta"},
            {value: "Purple", text: "Purple"},
            {value: "Maroon", text: "Maroon"},
            {value: "White", text: "White"}
        ]
    },
    {
        name: "Enable large text mode",
        label: "largeTextMode",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Maximum dynamic reporting rate for unreliable connections (in seconds)",
        label: "dynamicReportingRateMaxUnreliable",
        input_type: "text",
        value: "2"
    },
    {
        name: "Enable wave relay redirect",
        label: "waveRelayRedirect",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Mocking option for GPS",
        label: "mockingOption",
        input_type: "text",
        value: "WRGPS"
    },
    {
        name: "Secure delete timeout (in seconds)",
        label: "secureDeleteTimeout",
        input_type: "text",
        value: "10"
    },
    {
        name: "Compass heading display preference (e.g., Numeric, Cardinal)",
        label: "compass_heading_display",
        input_type: "text",
        value: "Numeric"
    },
    {
        name: "RAB bearing units preference",
        label: "rab_brg_units_pref",
        input_type: "text",
        value: "0"
    },
    {
        name: "Multicast TTL (Time to Live)",
        label: "multicastTTL",
        input_type: "text",
        value: "64"
    },
    {
        name: "Auto-disable mesh SA when streaming",
        label: "autoDisableMeshSAWhenStreaming",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Force airplane radio list for ATAK",
        label: "atakForceAirplaneRadioList",
        input_type: "text",
        value: "none"
    },
    {
        name: "Disable softkey illumination for ATAK",
        label: "atakDisableSoftkeyIllumination",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Minimum dynamic reporting rate for reliable connections (in seconds)",
        label: "dynamicReportingRateMinReliable",
        input_type: "text",
        value: "20"
    },
    {
        name: "Enable multicast loopback for network",
        label: "network_multicast_loopback",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable dispatch location COT external",
        label: "dispatchLocationCotExternal",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Port number for secure file sharing web server",
        label: "filesharingSecureWebServerPort",
        input_type: "text",
        value: "8443"
    },
    {
        name: "Disable the secure file sharing web server port preference item",
        label: "disablePreferenceItem_filesharingSecureWebServerPort",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Dynamic reporting rate for stationary unreliable connections (in seconds)",
        label: "dynamicReportingRateStationaryUnreliable",
        input_type: "text",
        value: "30"
    },
    {
        name: "Dynamic reporting rate for stationary reliable connections (in seconds)",
        label: "dynamicReportingRateStationaryReliable",
        input_type: "text",
        value: "180"
    },
    {
        name: "Fade notification time (in seconds)",
        label: "fade_notification",
        input_type: "text",
        value: "90"
    },
    {
        name: "Force English language for the application",
        label: "forceEnglish",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable large action bar",
        label: "largeActionBar",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Shade for side pane handle",
        label: "sidepane_handle_shade",
        input_type: "text",
        value: "Dark"
    },
    {
        name: "Port number for secure API server",
        label: "apiSecureServerPort",
        input_type: "text",
        value: "8443"
    },
    {
        name: "Disable the secure API server port preference item",
        label: "disablePreferenceItem_apiSecureServerPort",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "SA SIP (Session Initiation Protocol) address assignment",
        label: "saSipAddressAssignment",
        input_type: "text",
        value: "No VoIP"
    },
    {
        name: "Enable DEX (Desktop Experience) controls",
        label: "dexControls",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "URL for ATAK update server",
        label: "atakUpdateServerUrl",
        input_type: "text",
        value: "https://10.100.100.22:8443/update"
    },
    {
        name: "Show map scale",
        label: "map_scale_visible",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable double tap to zoom for ATAK",
        label: "atakDoubleTapToZoom",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Enable non-streaming connections",
        label: "enableNonStreamingConnections",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Smart cache download limit (in bytes)",
        label: "prefs_smart_cache_download_limit",
        input_type: "text",
        value: "5000000"
    },
    {
        name: "Width and height for overlay manager",
        label: "overlay_manager_width_height",
        input_type: "text",
        value: "33"
    },
    {
        name: "Use KLV (Key-Length-Value) elevation preference",
        label: "prefs_use_klv_elevation",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Scroll to self on start",
        label: "scrollToSelfOnStart",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "RAB north reference preference",
        label: "rab_north_ref_pref",
        input_type: "text",
        value: "1"
    },
    {
        name: "Location unit type (e.g., a-f-G-U-C)",
        label: "locationUnitType",
        input_type: "text",
        value: "a-f-G-U-C"
    },
    {
        name: "Altitude unit preference",
        label: "alt_unit_pref",
        input_type: "text",
        value: "0"
    },
    {
        name: "Key length for API certificate enrollment",
        label: "apiCertEnrollmentKeyLength",
        input_type: "text",
        value: "4096"
    },
    {
        name: "Disable the API certificate enrollment key length preference item",
        label: "disablePreferenceItem_apiCertEnrollmentKeyLength",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Monitor server connections",
        label: "monitorServerConnections",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Disable the monitor server connections preference item",
        label: "disablePreferenceItem_monitorServerConnections",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Speed unit preference",
        label: "speed_unit_pref",
        input_type: "text",
        value: "0"
    },
    {
        name: "Show layer outlines by default",
        label: "prefs_layer_outlines_default_show",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "ATAK role type (e.g., Team Member)",
        label: "atakRoleType",
        input_type: "text",
        value: "Team Member"
    },
    {
        name: "Display position of self coordinate info",
        label: "self_coord_info_display",
        input_type: "text",
        value: "bottom_right"
    },
    {
        name: "Restore recorded location on startup",
        label: "restoreRecordedLocation",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Frame limit for the application",
        label: "frame_limit",
        input_type: "text",
        value: "0"
    },
    {
        name: "Location reporting strategy (e.g., Dynamic)",
        label: "locationReportingStrategy",
        input_type: "text",
        value: "Dynamic"
    },
    {
        name: "Enable extended buttons in landscape mode",
        label: "landscape_extended_buttons",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "RAB range units preference",
        label: "rab_rng_units_pref",
        input_type: "text",
        value: "1"
    },
    {
        name: "Generate full pool of resources",
        label: "generate_full_pool",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Override permission request",
        label: "override_permission_request",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Log only errors to file",
        label: "loggingfile_error_only",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Reverse faux navigation bar",
        label: "faux_nav_bar_reverse",
        input_type: "checkbox",
        checked: true
    },
    {
        name: "Bluetooth reconnect interval for ATAK (in seconds)",
        label: "atakBluetoothReconnectSeconds",
        input_type: "text",
        value: "180"
    },
    {
        name: "Constant reporting rate for unreliable connections (in seconds)",
        label: "constantReportingRateUnreliable",
        input_type: "text",
        value: "3"
    },
    {
        name: "Log network traffic to file",
        label: "lognettraffictofile",
        input_type: "checkbox",
        checked: true
    }
];

function ApplicationPreferences({ preferences, searchTerm, onPreferenceChange, onEnableChange }) {
  const filteredPreferences = APP_PREFERENCES.filter(pref => 
    pref.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pref.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="divide-y divide-accentBoarder">
      {filteredPreferences.map((pref) => (
        <div key={pref.label} className="py-2 first:pt-0 last:pb-0">
          <PreferenceItem
            name={pref.name}
            label={pref.label}
            input_type={pref.input_type}
            value={preferences[pref.label]?.value ?? pref.value}
            checked={pref.input_type === 'checkbox' ? preferences[pref.label]?.checked ?? pref.checked : undefined}
            options={pref.options}
            isEnabled={preferences[pref.label]?.enabled ?? false}
            onChange={(e) => {
              const value = pref.input_type === 'checkbox' 
                ? e.target.checked 
                : e.target.value;
              onPreferenceChange(pref.label, value);
            }}
            onEnableChange={(enabled) => onEnableChange(pref.label, enabled)}
          />
        </div>
      ))}
    </div>
  );
}

export default ApplicationPreferences; 