# The following file path is commented out for reference
# backend/services/scripts/ota_helpers/generate_content.py

import os
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class GenerateOTAContent():
    def __init__(self):
        self.working_dir = self.get_default_working_directory()
        self.takserver_version = self.get_takserver_version()

    def get_default_working_directory(self):
        """Get the working directory from environment variable."""
        base_dir = '/home/tak-manager'  # Use the container mount point directly
        working_dir = os.path.join(base_dir, 'takserver')
        if not os.path.exists(working_dir):
            os.makedirs(working_dir, exist_ok=True)
            logger.debug(f"[GenerateOTAContent] Created working directory: {working_dir}")
        else:
            logger.debug(f"[GenerateOTAContent] Using existing working directory: {working_dir}")
        return working_dir

    def get_takserver_version(self):
        """Get TAK Server version from version.txt if it exists."""
        version_file_path = os.path.join(self.working_dir, "version.txt")
        logger.debug(f"[GenerateOTAContent] Checking for version file at: {version_file_path}")
        
        if os.path.exists(version_file_path):
            try:
                with open(version_file_path, "r") as version_file:
                    version = version_file.read().strip()
                    logger.debug(f"[GenerateOTAContent] Found TAK Server version: '{version}'")
                    if not version:
                        logger.error("[GenerateOTAContent] Version file exists but is empty")
                        return "5.2-release-43"  # Default version if file is empty
                    return version
            except Exception as e:
                logger.error(f"[GenerateOTAContent] Error reading version file: {str(e)}")
                return "5.2-release-43"  # Default version if error reading file
        else:
            logger.error(f"[GenerateOTAContent] Version file not found at: {version_file_path}")
            return "5.2-release-43"  # Default version if file doesn't exist

    def generate_inf_content(self):
        return r"""#!/bin/bash

# creates the product.inf file given a list of apks. Optionally creates the INFZ (zipped OTA repo)

AAPT=/opt/android-sdk/build-tools/33.0.0/aapt 

extract-apk-icon () { unzip -p $1 $($AAPT d --values badging $1 | sed -n "/^application: /s/.*icon='\([^']*\).*/\1/p") > $2; }


if [[  "$1" == "" ]];
then 
    echo "./generate-inf.sh [staging directory containing APK files] [true | false:  create INFZ]"
    exit 1
fi

if [[ ! -f $AAPT ]];
then 
    echo "cannot find $AAPT"
    exit 1
fi


rm $1/product.inf
rm $1/product.infz
echo "#platform (Android Windows or iOS), type (app or plugin), full package name, display/label, version, revision code (integer), relative path to APK file, relative path to icon file, description, apk hash, os requirement, tak prereq (e.g. plugin-api), apk size" >> $1/product.inf

for FILE in $1/*;do

   echo "processing: $FILE"

   if [[ $FILE == *apk ]];
   then

       PACKAGE_LINE=`$AAPT dump badging $FILE | grep ^package`
       IFS=';' tmparray=($(echo "$PACKAGE_LINE" | tr "'" ";"))
       
       PACKAGE_NAME=${tmparray[1]}
       PACKAGE_VERSIONCODE=${tmparray[3]}
       PACKAGE_VERSIONNAME=${tmparray[5]}

       ANDROID_VERSION_LINE=`$AAPT dump badging $FILE | grep sdkVersion`
       NAME_LINE=`$AAPT dump badging $FILE | grep "application-label:"`
       IFS=';' tmparray=($(echo "$ANDROID_VERSION_LINE $NAME_LINE" | tr "'" ";"))
       ANDROID_VERSION=${tmparray[1]}
       NAME=${tmparray[3]}
       
       



       TMP=`$AAPT dump --include-meta-data badging $FILE | grep app_desc`
       IFS=';' descarr=($(echo "$TMP" | tr "'" ";"))
       DESC=${descarr[3]//,/\.}

       GRAPHIC=${FILE/\.apk/\.png/}
       APP=app
       if [[ $FILE == *"Plugin"* ]]; then
        APP=plugin
       fi

       if [[  "$DESC" == "" ]];
       then 
          DESC="No description supplied for $NAME $PACKAGE_VERSIONNAME"
       fi

       SHA256=`shasum -a 256 $FILE | awk '{ print $1 }'`
       FILESIZE=$(wc -c < "$FILE")

#       echo ">> $PACKAGE_NAME $PACKAGE_VERSIONCODE $PACKAGE_VERSIONNAME $NAME $ANDROID_VERSION"


       # determine the plugin api
       papi=`$AAPT dump --include-meta-data badging $FILE | grep plugin-api`
       IFS=';' papiarr=($(echo "$papi" | tr "'" ";"))
       PLUGINAPI=${papiarr[3]//,/\.}
       # echo ">> $PLUGINAPI"
        

       entry="Android,$APP,$PACKAGE_NAME,$NAME,$PACKAGE_VERSIONNAME,$PACKAGE_VERSIONCODE,`basename $FILE`,`basename $GRAPHIC`,$DESC,$SHA256,$ANDROID_VERSION,$PLUGINAPI,$FILESIZE"
       echo $entry >> $1/product.inf
       echo "generating entry: $entry"


#      if [[  "$2" == "true" ]];
#      then 
          #also dump app icon
          filename=$(basename "$FILE")
          filename="${filename%.*}.png"

          echo "extracting $parentname $filename"
          extract-apk-icon $FILE $1/$filename
#      fi
   fi
done

if [[  "$2" == "true" ]];
then 
   echo "generating infz"
   zip -r -j --exclude=*.apk* --exclude=*.DS_Store* $1/product.infz  $1
fi

echo "Note, currently you may need to populate the app description (column I) if the app developer did not add this information into their AndroidManifest.xml file."
"""

    def update_dockerfile(self):
        dockerfile_content = """
# Use a base image
FROM eclipse-temurin:17-jammy

# Install necessary dependencies
RUN apt update && \\
apt-get install -y wget unzip openjdk-17-jdk dos2unix coreutils zip emacs-nox net-tools perl netcat vim && \\
rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools

# Download and install Android SDK command-line tools
RUN mkdir -p $ANDROID_SDK_ROOT/cmdline-tools && \\
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip -O commandlinetools.zip && \\
unzip commandlinetools.zip -d $ANDROID_SDK_ROOT/cmdline-tools && \\
rm commandlinetools.zip && \\
mv $ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools $ANDROID_SDK_ROOT/cmdline-tools/latest

# Accept licenses and install build tools and SDK
RUN yes | sdkmanager --licenses && \\
sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"

# Set up entrypoint
ENTRYPOINT ["/bin/bash", "-c", "/opt/tak/configureInDocker.sh init &>> /opt/tak/logs/takserver.log"]
"""
        return dockerfile_content
    
    def update_docker_compose_file(self):
        docker_compose_content = f"""
services:
  takserver-db:
    build:
      context: .
      dockerfile: docker/Dockerfile.takserver-db
    platform: linux/amd64
    container_name: tak-database-{self.takserver_version}
    hostname: tak-database
    init: true
    networks:
      - net
    ports:
      - 5432:5432
    restart: unless-stopped
    tty: true
    volumes:
      - ${{TAK_DIR}}:/opt/tak:z
      - db-data:/var/lib/postgresql/data:z

  takserver:
    build:
      context: .
      dockerfile: docker/Dockerfile.takserver
    platform: linux/amd64
    container_name: takserver-{self.takserver_version}
    hostname: takserver
    init: true
    networks:
      - net
    ports:
      - 8443:8443
      - 8446:8446
      - 8089:8089
      - 8444:8444
    restart: unless-stopped
    tty: true
    volumes:
      - ${{TAK_DIR}}:/opt/tak:z
      - ${{PLUGINS_DIR}}:/opt/tak/webcontent:z

networks:
  net:
    name: 'takserver'
    ipam:
      driver: default
      config:
        - subnet: 172.16.16.0/24

volumes:
  db-data:  # Declaring the named volume for takserver-db
"""
        return docker_compose_content
