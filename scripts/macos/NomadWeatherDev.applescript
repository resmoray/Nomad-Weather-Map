property cachedProjectDir : ""

on isProjectDir(projectDir)
	try
		set launchScriptPath to projectDir & "/scripts/launch-dev.sh"
		set packageJsonPath to projectDir & "/package.json"
		do shell script "test -f " & quoted form of packageJsonPath & " && test -f " & quoted form of launchScriptPath
		return true
	on error
		return false
	end try
end isProjectDir

on trimTrailingSlash(projectDir)
	if projectDir ends with "/" then
		return text 1 thru -2 of projectDir
	end if

	return projectDir
end trimTrailingSlash

on resolveProjectDir()
	if cachedProjectDir is not "" and my isProjectDir(cachedProjectDir) then
		return cachedProjectDir
	end if

	try
		set appScriptDir to POSIX path of ((path to me as text) & "::")
		set repoCandidate to do shell script "cd " & quoted form of appScriptDir & " && cd ../../../../ && pwd"
		set repoCandidate to my trimTrailingSlash(repoCandidate)
		if my isProjectDir(repoCandidate) then
			set cachedProjectDir to repoCandidate
			return cachedProjectDir
		end if
	end try

	set selectedFolder to choose folder with prompt "Select the Nomad Weather Map project folder:"
	set selectedPath to my trimTrailingSlash(POSIX path of selectedFolder)

	if not my isProjectDir(selectedPath) then
		display dialog "Selected folder is missing package.json or scripts/launch-dev.sh." buttons {"OK"} default button "OK" with icon caution
		error number -128
	end if

	set cachedProjectDir to selectedPath
	return cachedProjectDir
end resolveProjectDir

set projectDir to my resolveProjectDir()
set launchCommand to "cd " & quoted form of projectDir & " && ./scripts/launch-dev.sh; exit"
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
