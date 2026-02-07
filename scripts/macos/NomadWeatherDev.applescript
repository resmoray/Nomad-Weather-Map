set projectDir to "/Users/amg/Documents/01_Admin & Privat/03_Codex ChatGPT/Nomad Weather Map"
set launchCommand to "cd " & quoted form of projectDir & " && NOMAD_LAUNCHED_FROM_APP=1 ./scripts/launch-dev.sh; exit"
set wasRunning to application "Terminal" is running

tell application "Terminal"
	activate
	if wasRunning then
		set launchWindow to do script launchCommand
	else
		do script launchCommand in window 1
		set launchWindow to window 1
	end if

	repeat while busy of launchWindow
		delay 1
	end repeat

	close launchWindow saving no
end tell
