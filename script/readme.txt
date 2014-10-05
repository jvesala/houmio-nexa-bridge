Add following lines to /etc/rc.local (change to proper directory)

echo "Starting houmio-nexa-bridge tmux..."
su pi -c "/opt/houmio-nexa-bridge/script/houmio-nexa-bridge-startup.sh"
echo "...houmio-nexa-bridge started."
