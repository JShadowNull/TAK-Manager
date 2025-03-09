import { z } from 'zod';
import { atakPreferenceSchema } from '../shared/validationSchemas';

export interface PreferenceOption {
  value: string;
  text: string;
}

export interface AtakPreference {
  name: string;
  label: string;
  input_type: 'text' | 'select' | 'number' | 'password';
  options?: PreferenceOption[];
  category: keyof typeof PREFERENCE_CATEGORIES;
  defaultValue?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface PreferenceState {
  value: string;
  enabled: boolean;
}

export const PREFERENCE_CATEGORIES = {
  DISPLAY: "Display Settings",
  NETWORK: "Network Settings",
  LOCATION: "Location Settings",
  SECURITY: "Security Settings",
  FILE_SHARING: "File Sharing",
  NOTIFICATIONS: "Notifications",
  CONTROLS: "Controls & Navigation",
  LOGGING: "Logging & Debug",
  SYSTEM: "System Settings",
  CUSTOM: "Custom Settings"
} as const;

// Rest of the ATAK_PREFERENCES array stays the same...
export const ATAK_PREFERENCES: AtakPreference[] = [
  {
    name: "Use team color for GPS icons",
    label: "team_color_gps_icon", 
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},

{
    name: "Enable notifications when other users are controlled",
    label: "atakControlOtherUserNotification",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NOTIFICATIONS",
    defaultValue: "true"
},
{
    name: "Show ETA (Estimated Time of Arrival) in RAB (Route and Bearing) preferences",
    label: "rab_preference_show_eta",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Minimum dynamic reporting rate for unreliable connections (in seconds)",
    label: "dynamicReportingRateMinUnreliable", 
    input_type: "text",
    placeholder: "20",
    category: "NETWORK"
},
{
    name: "Use WR (Wave Relay) callsign for location reporting",
    label: "locationUseWRCallsign",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOCATION",
    defaultValue: "true"
},
{
    name: "Disable the EUD (End User Device) API option",
    label: "eud_api_disable_option",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SECURITY",
    defaultValue: "true"
},
{
    name: "Enable scanning for plugins on startup",
    label: "atakPluginScanningOnStartup",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "false"
},
{
    name: "Disable automatic linking of map item links",
    label: "disable_autolink_mapitem_links",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},

{
    name: "Enable file sharing functionality",
    label: "filesharingEnabled",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "FILE_SHARING",
    defaultValue: "true"
},
{
    name: "Disable the file sharing preference item",
    label: "disablePreferenceItem_filesharingEnabled",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "FILE_SHARING",
    defaultValue: "true"
},
{
    name: "Hide dispatch location",
    label: "dispatchLocationHidden",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Show map zoom controls",
    label: "map_zoom_visible",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Enable logging to file",
    label: "loggingfile",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOGGING",
    defaultValue: "true"
},
{
    name: "Toggle visibility of DPGK (Digital Precision Grid Kit) root",
    label: "dpgkRootVisibilityToggle",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Use custom color for GPS icons",
    label: "custom_color_gps_icon_pref",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Timeout for file sharing connections (in seconds)",
    label: "filesharingConnectionTimeoutSecs",
    input_type: "text",
    placeholder: "10",
    category: "FILE_SHARING"
},
{
    name: "Display altitude as AGL (Above Ground Level)",
    label: "alt_display_agl",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Dim the map with the brightness key",
    label: "dim_map_with_brightness_key",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Ask for confirmation before quitting ATAK control",
    label: "atakControlAskToQuit",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Number of attempts to download files in file sharing",
    label: "fileshareDownloadAttempts",
    input_type: "text",
    placeholder: "10",
    category: "FILE_SHARING"
},
{
    name: "Name of the imagery tab",
    label: "imagery_tab_name",
    input_type: "select",
    placeholder: "Imagery",
    options: [
        {value: "Imagery", text: "Imagery"},
        {value: "Maps", text: "Maps"}
    ],
    category: "DISPLAY"
},
{
    name: "Port number for chat functionality",
    label: "chatPort",
    input_type: "text",
    placeholder: "17012",
    category: "NETWORK"
},
{
    name: "Disable the chat port preference item",
    label: "disablePreferenceItem_chatPort",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Scale factor for location markers",
    label: "location_marker_scale_key",
    input_type: "text",
    category: "DISPLAY",
    defaultValue: "-1"
},
{
    name: "Enable audible notifications",
    label: "audibleNotify",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NOTIFICATIONS",
    defaultValue: "true"
},
{
    name: "Enable Bluetooth for ATAK control",
    label: "atakControlBluetooth",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Display range in feet",
    label: "rng_feet_display_pref",
    input_type: "text",
    placeholder: "5280",
    category: "DISPLAY"
},
{
    name: "Enable toast notifications",
    label: "enableToast",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NOTIFICATIONS",
    defaultValue: "true"
},
{
    name: "Enable developer tools",
    label: "atakDeveloperTools",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Enable automatic upload of logs",
    label: "enableAutoUploadLogs",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOGGING",
    defaultValue: "true"
},
{
    name: "Reverse orientation for ATAK control",
    label: "atakControlReverseOrientation",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Only allow streaming with VPN enabled",
    label: "onlyStreamingWithVPN",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Altitude display preference (MSL - Mean Sea Level)",
    label: "alt_display_pref",
    input_type: "select",
    options: [
        {value: "MSL", text: "Mean Sea Level"},
        {value: "HAE", text: "Height Above Ellipsoid"}
    ],
    category: "DISPLAY",
    defaultValue: "MSL"
},
{
    name: "Timeout for TCP connections (in seconds)",
    label: "tcpConnectTimeout",
    input_type: "text",
    placeholder: "20",
    category: "NETWORK"
},
{
    name: "Multicast address for chat functionality",
    label: "chatAddress",
    input_type: "text",
    placeholder: "224.10.10.1",
    category: "NETWORK"
},
{
    name: "Disable the chat address preference item",
    label: "disablePreferenceItem_chatAddress",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Timeout for file sharing transfers (in seconds)",
    label: "filesharingTransferTimeoutSecs",
    input_type: "text",
    placeholder: "10",
    category: "FILE_SHARING"
},
{
    name: "Enable phone number in SA (Situational Awareness)",
    label: "saHasPhoneNumber",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOCATION",
    defaultValue: "true"
},
{
    name: "Tabs for coordinate entry",
    label: "coordinate_entry_tabs",
    input_type: "text",
    placeholder: "",
    category: "DISPLAY"
},
{
    name: "Enable volume map switcher",
    label: "volumemapswitcher",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "RAB distance slant range preference",
    label: "rab_dist_slant_range",
    input_type: "text",
    placeholder: "clamped",
    category: "DISPLAY"
},
{
    name: "Enable QUIC (Quick UDP Internet Connections) protocol",
    label: "network_quic_enabled",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Enable high-speed capability for PPP0 (Point-to-Point Protocol)",
    label: "ppp0_highspeed_capable",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Enable faux navigation bar",
    label: "faux_nav_bar",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Enable repository startup synchronization",
    label: "repoStartupSync",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Constant reporting rate for reliable connections (in seconds)",
    label: "constantReportingRateReliable",
    input_type: "text",
    placeholder: "15",
    category: "NETWORK"
},
{
    name: "Camera chooser for QuickPic application",
    label: "quickpic.camera_chooser",
    input_type: "select",
    options: [
        {value: "system", text: "System"},
        {value: "takgeocam", text: "TAK GeoCam"}
    ],
    category: "DISPLAY"
},
{
    name: "Display server connection widget",
    label: "displayServerConnectionWidget",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Port number for unsecure API server",
    label: "apiUnsecureServerPort",
    input_type: "text",
    placeholder: "8080",
    category: "NETWORK"
},
{
    name: "Disable the unsecure API server port preference item",
    label: "disablePreferenceItem_apiUnsecureServerPort",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Toggle visibility of GRG root",
    label: "grgRootVisibilityToggle",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Action for long press on map in ATAK",
    label: "atakLongPressMap",
    input_type: "text",
    placeholder: "nothing",
    category: "CONTROLS"
},
{
    name: "Prefer alternate number for display",
    label: "preferAltNumber",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Timeout for UDP connections with no data (in seconds)",
    label: "udpNoDataTimeout",
    input_type: "text",
    placeholder: "30",
    category: "NETWORK"
},
{
    name: "Enable metrics collection",
    label: "collect_metrics",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Use default GPS icon",
    label: "default_gps_icon",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Enable dispatch location COT external at start",
    label: "dispatchLocationCotExternalAtStart",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOCATION",
    defaultValue: "true"
},
{
    name: "Adjust curved display for ATAK",
    label: "atakAdjustCurvedDisplay",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Insert destination in directed CoT messages",
    label: "insertDestInDirectedCoT",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOCATION",
    defaultValue: "true"
},
{
    name: "Shorten labels for ATAK control",
    label: "atakControlShortenLabels",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Port number for file sharing web server",
    label: "filesharingWebServerPort",
    input_type: "text",
    placeholder: "8080",
    category: "FILE_SHARING"
},
{
    name: "Disable the file sharing web server port preference item",
    label: "disablePreferenceItem_filesharingWebServerPort",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "FILE_SHARING",
    defaultValue: "true"
},
{
    name: "Maximum dynamic reporting rate for reliable connections (in seconds)",
    label: "dynamicReportingRateMaxReliable",
    input_type: "text",
    placeholder: "2",
    category: "NETWORK"
},
{
    name: "Show labels for ATAK control",
    label: "atakControlShowLabels",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Quit ATAK control on back button press",
    label: "atakControlQuitOnBack",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Enable update server for app management",
    label: "appMgmtEnableUpdateServer",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Disable the app management update server preference item",
    label: "disablePreferenceItem_ppMgmtEnableUpdateServer",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Enable phone vibration",
    label: "vibratePhone",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Forced brightness level for ATAK",
    label: "atakForcedBrightness",
    input_type: "text",
    placeholder: "-1",
    category: "DISPLAY"
},
{
    name: "Enable device profile on connect",
    label: "deviceProfileEnableOnConnect",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Disable the device profile on connect preference item",
    label: "disablePreferenceItem_deviceProfileEnableOnConnect",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Set domain preference (e.g., Ground, Air)",
    label: "set_domain_pref",
    input_type: "text",
    placeholder: "Ground",
    category: "DISPLAY"
},
{
    name: "Text size for labels",
    label: "label_text_size",
    input_type: "text",
    placeholder: "14",
    category: "DISPLAY"
},
{
    name: "Enable permissive mode for HTTP client",
    label: "httpClientPermissiveMode",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Port number for API certificate enrollment",
    label: "apiCertEnrollmentPort",
    input_type: "text",
    placeholder: "8446",
    category: "SECURITY"
},
{
    name: "Disable the API certificate enrollment port preference item",
    label: "disablePreferenceItem_apiCertEnrollmentPort",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SECURITY",
    defaultValue: "true"
},
{
    name: "Enable file sharing for all servers",
    label: "filesharingAllServers",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "FILE_SHARING",
    defaultValue: "true"
},
{
    name: "Disable the file sharing all servers preference item",
    label: "disablePreferenceItem_ilesharingAllServers",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "FILE_SHARING",
    defaultValue: "true"
},
{
    name: "Enable map scale rounding",
    label: "map_scale_rounding",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Enable real-time metrics",
    label: "realtime_metrics",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Range in meters display preference",
    label: "rng_meters_display_pref",
    input_type: "text",
    placeholder: "2000",
    category: "DISPLAY"
},
{
    name: "Coordinate display preference (e.g., MGRS, UTM)",
    label: "coord_display_pref",
    input_type: "text",
    placeholder: "MGRS",
    category: "DISPLAY"
},
{
    name: "Enable screen lock for ATAK",
    label: "atakScreenLock",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Show map eye altitude",
    label: "map_eyealt_visible",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Enable logging file upload for debugging",
    label: "loggingfile_upload_debug",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOGGING",
    defaultValue: "true"
},
{
    name: "RAB color preference",
    label: "rab_color_pref",
    input_type: "text",
    placeholder: "red",
    category: "DISPLAY"
},
{
    name: "Layer outline color preference",
    label: "pref_layer_outline_color",
    input_type: "text",
    placeholder: "#00ff00",
    category: "DISPLAY"
},
{
    name: "Show map center designator",
    label: "map_center_designator",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Enable right navigation orientation",
    label: "nav_orientation_right",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Enable smart cache",
    label: "prefs_enable_smart_cache",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Enable globe mode for ATAK",
    label: "atakGlobeModeEnabled",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Show TAK version number in dispatch",
    label: "dispatchTAKVersionNumber",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Enable certificate enrollment export",
    label: "certEnrollmentExport",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SECURITY",
    defaultValue: "true"
},
{
    name: "Disable the certificate enrollment export preference item",
    label: "disablePreferenceItem_certEnrollmentExport",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SECURITY",
    defaultValue: "true"
},
{
    name: "Auto-close tilt rotation menu",
    label: "tilt_rotation_menu_auto_close",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Center self on back button press",
    label: "atakBackButtonCenterSelf",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Enable legacy HTTP for file sharing web server",
    label: "filesharingWebServerLegacyHttpEnabled",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "FILE_SHARING",
    defaultValue: "true"
},
{
    name: "File sharing size threshold for no-go (in MB)",
    label: "filesharingSizeThresholdNoGo",
    input_type: "text",
    placeholder: "100",
    category: "FILE_SHARING"
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
    ],
    category: "DISPLAY"
},
{
    name: "Enable large text mode",
    label: "largeTextMode",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Maximum dynamic reporting rate for unreliable connections (in seconds)",
    label: "dynamicReportingRateMaxUnreliable",
    input_type: "text",
    placeholder: "2",
    category: "NETWORK"
},
{
    name: "Enable wave relay redirect",
    label: "waveRelayRedirect",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Mocking option for GPS",
    label: "mockingOption",
    input_type: "text",
    placeholder: "WRGPS",
    category: "NETWORK"
},
{
    name: "Secure delete timeout (in seconds)",
    label: "secureDeleteTimeout",
    input_type: "text",
    placeholder: "10",
    category: "SYSTEM"
},
{
    name: "Compass heading display preference (e.g., Numeric, Cardinal)",
    label: "compass_heading_display",
    input_type: "text",
    placeholder: "Numeric",
    category: "DISPLAY"
},
{
    name: "RAB bearing units preference",
    label: "rab_brg_units_pref",
    input_type: "text",
    placeholder: "0",
    category: "DISPLAY"
},
{
    name: "Multicast TTL (Time to Live)",
    label: "multicastTTL",
    input_type: "text",
    placeholder: "64",
    category: "NETWORK"
},
{
    name: "Auto-disable mesh SA when streaming",
    label: "autoDisableMeshSAWhenStreaming",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Force airplane radio list for ATAK",
    label: "atakForceAirplaneRadioList",
    input_type: "text",
    placeholder: "none",
    category: "NETWORK"
},
{
    name: "Disable softkey illumination for ATAK",
    label: "atakDisableSoftkeyIllumination",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Minimum dynamic reporting rate for reliable connections (in seconds)",
    label: "dynamicReportingRateMinReliable",
    input_type: "text",
    placeholder: "20",
    category: "NETWORK"
},
{
    name: "Enable multicast loopback for network",
    label: "network_multicast_loopback",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Enable dispatch location COT external",
    label: "dispatchLocationCotExternal",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOCATION",
    defaultValue: "true"
},
{
    name: "Port number for secure file sharing web server",
    label: "filesharingSecureWebServerPort",
    input_type: "text",
    placeholder: "8443",
    category: "FILE_SHARING"
},
{
    name: "Disable the secure file sharing web server port preference item",
    label: "disablePreferenceItem_filesharingSecureWebServerPort",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "FILE_SHARING",
    defaultValue: "true"
},
{
    name: "Dynamic reporting rate for stationary unreliable connections (in seconds)",
    label: "dynamicReportingRateStationaryUnreliable",
    input_type: "text",
    placeholder: "30",
    category: "NETWORK"
},
{
    name: "Dynamic reporting rate for stationary reliable connections (in seconds)",
    label: "dynamicReportingRateStationaryReliable",
    input_type: "text",
    placeholder: "180",
    category: "NETWORK"
},
{
    name: "Fade notification time (in seconds)",
    label: "fade_notification",
    input_type: "text",
    placeholder: "90",
    category: "NOTIFICATIONS"
},
{
    name: "Force English language for the application",
    label: "forceEnglish",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Enable large action bar",
    label: "largeActionBar",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Shade for side pane handle",
    label: "sidepane_handle_shade",
    input_type: "text",
    placeholder: "Dark",
    category: "DISPLAY"
},
{
    name: "Port number for secure API server",
    label: "apiSecureServerPort",
    input_type: "text",
    placeholder: "8443",
    category: "SECURITY"
},
{
    name: "Disable the secure API server port preference item",
    label: "disablePreferenceItem_apiSecureServerPort",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SECURITY",
    defaultValue: "true"
},
{
    name: "SA SIP (Session Initiation Protocol) address assignment",
    label: "saSipAddressAssignment",
    input_type: "text",
    placeholder: "No VoIP",
    category: "NETWORK"
},
{
    name: "Enable DEX (Desktop Experience) controls",
    label: "dexControls",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "URL for ATAK update server",
    label: "atakUpdateServerUrl",
    input_type: "text",
    placeholder: "https://10.100.100.22:8443/update",
    category: "SYSTEM"
},
{
    name: "Show map scale",
    label: "map_scale_visible",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Enable double tap to zoom for ATAK",
    label: "atakDoubleTapToZoom",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "CONTROLS",
    defaultValue: "true"
},
{
    name: "Enable non-streaming connections",
    label: "enableNonStreamingConnections",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "NETWORK",
    defaultValue: "true"
},
{
    name: "Smart cache download limit (in bytes)",
    label: "prefs_smart_cache_download_limit",
    input_type: "text",
    placeholder: "5000000",
    category: "SYSTEM"
},
{
    name: "Width and height for overlay manager",
    label: "overlay_manager_width_height",
    input_type: "text",
    placeholder: "33",
    category: "DISPLAY"
},
{
    name: "Use KLV (Key-Length-Value) elevation preference",
    label: "prefs_use_klv_elevation",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Scroll to self on start",
    label: "scrollToSelfOnStart",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "RAB north reference preference",
    label: "rab_north_ref_pref",
    input_type: "text",
    placeholder: "1",
    category: "DISPLAY"
},
{
    name: "Location unit type (e.g., a-f-G-U-C)",
    label: "locationUnitType",
    input_type: "text",
    placeholder: "a-f-G-U-C",
    category: "DISPLAY"
},
{
    name: "Altitude unit preference",
    label: "alt_unit_pref",
    input_type: "text",
    placeholder: "0",
    category: "DISPLAY"
},
{
    name: "Key length for API certificate enrollment",
    label: "apiCertEnrollmentKeyLength",
    input_type: "text",
    placeholder: "4096",
    category: "SECURITY"
},
{
    name: "Disable the API certificate enrollment key length preference item",
    label: "disablePreferenceItem_apiCertEnrollmentKeyLength",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SECURITY",
    defaultValue: "true"
},
{
    name: "Monitor server connections",
    label: "monitorServerConnections",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Disable the monitor server connections preference item",
    label: "disablePreferenceItem_monitorServerConnections",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Speed unit preference",
    label: "speed_unit_pref",
    input_type: "text",
    placeholder: "0",
    category: "DISPLAY"
},
{
    name: "Show layer outlines by default",
    label: "prefs_layer_outlines_default_show",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "ATAK role type (e.g., Team Member)",
    label: "atakRoleType",
    input_type: "text",
    placeholder: "Team Member",
    category: "DISPLAY"
},
{
    name: "Display position of self coordinate info",
    label: "self_coord_info_display",
    input_type: "text",
    placeholder: "bottom_right",
    category: "DISPLAY"
},
{
    name: "Restore recorded location on startup",
    label: "restoreRecordedLocation",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Frame limit for the application",
    label: "frame_limit",
    input_type: "text",
    placeholder: "0",
    category: "SYSTEM"
},
{
    name: "Location reporting strategy (e.g., Dynamic)",
    label: "locationReportingStrategy",
    input_type: "text",
    placeholder: "Dynamic",
    category: "LOCATION"
},
{
    name: "Enable extended buttons in landscape mode",
    label: "landscape_extended_buttons",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "RAB range units preference",
    label: "rab_rng_units_pref",
    input_type: "text",
    placeholder: "1",
    category: "DISPLAY"
},
{
    name: "Generate full pool of resources",
    label: "generate_full_pool",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Override permission request",
    label: "override_permission_request",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "SYSTEM",
    defaultValue: "true"
},
{
    name: "Log only errors to file",
    label: "loggingfile_error_only",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOGGING",
    defaultValue: "true"
},
{
    name: "Reverse faux navigation bar",
    label: "faux_nav_bar_reverse",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "DISPLAY",
    defaultValue: "true"
},
{
    name: "Bluetooth reconnect interval for ATAK (in seconds)",
    label: "atakBluetoothReconnectSeconds",
    input_type: "text",
    placeholder: "180",
    category: "NETWORK"
},
{
    name: "Constant reporting rate for unreliable connections (in seconds)",
    label: "constantReportingRateUnreliable",
    input_type: "text",
    placeholder: "3",
    category: "NETWORK"
},
{
    name: "Log network traffic to file",
    label: "lognettraffictofile",
    input_type: "select",
    options: [
        { value: "true", text: "True" },
        { value: "false", text: "False" }
    ],
    category: "LOGGING",
    defaultValue: "true"
}
];

export const validateAtakPreferences = (preferences: Record<string, PreferenceState>): Record<string, string> => {
  const errors: Record<string, string> = {};

  Object.entries(preferences).forEach(([label, pref]) => {
    if (!pref.enabled) return;

    const prefConfig = ATAK_PREFERENCES.find(p => p.label === label);
    if (!prefConfig) return;

    try {
      atakPreferenceSchema.parse({
        ...pref,
        input_type: prefConfig.input_type,
        options: prefConfig.options,
        min: prefConfig.min,
        max: prefConfig.max
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors[label] = error.errors[0].message;
      }
    }
  });

  return errors;
};

export const addCustomPreference = (
  preferences: AtakPreference[],
  name: string,
  label: string,
  input_type: 'text' | 'select' | 'number' | 'password',
  options?: PreferenceOption[],
  defaultValue?: string
): AtakPreference[] => {
  const newPreference: AtakPreference = {
    name,
    label,
    input_type,
    options,
    category: 'CUSTOM',
    defaultValue
  };
  
  return [...preferences, newPreference];
};

export const removeCustomPreference = (
  preferences: AtakPreference[],
  labelToRemove: string
): AtakPreference[] => {
  return preferences.filter(pref => pref.label !== labelToRemove);
};

export const CUSTOM_PREFERENCES_KEY = 'custom_atak_preferences';

export const loadCustomPreferences = (): AtakPreference[] => {
  try {
    const saved = localStorage.getItem(CUSTOM_PREFERENCES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveCustomPreferences = (preferences: AtakPreference[]) => {
  localStorage.setItem(CUSTOM_PREFERENCES_KEY, JSON.stringify(preferences));
};

// Parse ATAK preferences XML file
export const parseAtakPreferencesXml = (xmlContent: string): Record<string, string> => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    
    // Find the com.atakmap.app_preferences section
    const appPreferences = xmlDoc.querySelector('preference[name="com.atakmap.app.civ_preferences"]');
    if (!appPreferences) {
      throw new Error("No ATAK app preferences found in the file");
    }
    
    // Extract all entries
    const entries = appPreferences.querySelectorAll('entry');
    const preferences: Record<string, string> = {};
    
    entries.forEach(entry => {
      const key = entry.getAttribute('key');
      if (key) {
        // Get the text content of the entry
        const value = entry.textContent?.trim() || '';
        preferences[key] = value;
      }
    });
    
    return preferences;
  } catch (error) {
    console.error("Error parsing ATAK preferences file:", error);
    throw error;
  }
};

// Import ATAK preferences from parsed XML data
export const importAtakPreferences = (
  parsedPreferences: Record<string, string>,
  currentPreferences: Record<string, PreferenceState>,
  atakPreferencesList: AtakPreference[]
): {
  updatedPreferences: Record<string, PreferenceState>,
  newCustomPreferences: AtakPreference[]
} => {
  const updatedPreferences = { ...currentPreferences };
  const existingLabels = new Set(atakPreferencesList.map(pref => pref.label));
  const newCustomPreferences: AtakPreference[] = [];
  
  // Process each preference from the XML
  Object.entries(parsedPreferences).forEach(([key, value]) => {
    // Check if this preference exists in our current list
    if (existingLabels.has(key)) {
      // Update existing preference
      updatedPreferences[key] = {
        value: convertAtakValueToString(value),
        enabled: true
      };
    } else {
      // Add as custom preference
      const inputType = determineInputType(value);
      const newPref: AtakPreference = {
        name: key, // Use the key as the name if no better name is available
        label: key,
        input_type: inputType,
        category: 'CUSTOM',
        defaultValue: convertAtakValueToString(value)
      };
      
      // Add options for boolean values
      if (inputType === 'select' && (value === 'true' || value === 'false')) {
        newPref.options = [
          { value: 'true', text: 'True' },
          { value: 'false', text: 'False' }
        ];
      }
      
      newCustomPreferences.push(newPref);
      
      // Also add to updated preferences
      updatedPreferences[key] = {
        value: convertAtakValueToString(value),
        enabled: true
      };
    }
  });
  
  return { updatedPreferences, newCustomPreferences };
};

// Helper function to determine input type based on value
const determineInputType = (value: string): 'text' | 'select' | 'number' | 'password' => {
  // Check if it's a boolean
  if (value === 'true' || value === 'false') {
    return 'select';
  }
  
  // Check if it's a number
  if (!isNaN(Number(value)) && value.trim() !== '') {
    return 'number';
  }
  
  // Default to text
  return 'text';
};

// Helper function to convert ATAK values to string
const convertAtakValueToString = (value: string): string => {
  // Handle class java.lang.Boolean
  if (value === 'true' || value === 'false') {
    return value;
  }
  
  // Handle class java.lang.Integer or class java.lang.Float
  if (!isNaN(Number(value)) && value.trim() !== '') {
    return value;
  }
  
  // Default to the original string
  return value;
}; 