#!/bin/bash

# <xbar.title>Caffeinate+</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>Volodymyr Tereshchuk</xbar.author>
# <xbar.author.github>x0h01</xbar.author.github>
# <xbar.desc>A simple wrapper for the 'caffeinate' utility that prevents system from entering idle sleep mode</xbar.desc>
# <xbar.image>https://raw.githubusercontent.com/x0h01/xbar-plugins/master/screenshots/caffeinate+.png</xbar.image>
#
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>

# UTILITY UNDER THE HOOD
#	macOS caffeinate – prevent the system from sleeping on behalf of a utility
#
# SYNOPSIS
#	caffeinate [-disu] [-t timeout] [-w pid] [utility arguments...]
#
# DESCRIPTION
#	caffeinate creates assertions to alter system sleep behavior.  
#	If no assertion flags are specified, caffeinate creates an assertion to prevent idle sleep.  
#	If a utility is specified, caffeinate creates the assertions on the utility's
#	behalf, and those assertions will persist for the duration of the utility's execution. 
#	Otherwise, caffeinate creates the assertions directly, and those assertions will persist until caffeinate exits.
#
#	Available options:
#
#		-d      Create an assertion to prevent the display from sleeping.
#		-i      Create an assertion to prevent the system from idle sleeping.
#		-m      Create an assertion to prevent the disk from idle sleeping.
#		-s      Create an assertion to prevent the system from sleeping. This assertion is valid only when system is running on AC power.
#		-u      Create an assertion to declare that user is active. 
#				If the display is off, this option turns the display on and prevents the display from going into idle sleep. 
#				If a timeout is not specified with '-t' option, then this assertion is taken with a default of 5 second timeout.
#		-t      Specifies the timeout value in seconds for which this assertion has to be valid. 
#				The assertion is dropped after the specified timeout (e.g. -t 60)
#				Timeout value is not used when an utility is invoked with this command.
#		-w      Waits for the process with the specified pid to exit. 
#				Once the the process exits, the assertion is also released.  
#				This option is ignored when used with utility option.
#

# active mode color to be used in menu
ACTIVE_MODE_COLOR="#1a7f37"

# plugin's icons for active and inactive states
ICON_ACTIVE="PHN2ZyBmaWxsPSIjZjhmOWY5IiB3aWR0aD0iMTZweCIgaGVpZ2h0PSIxNnB4IiB2aWV3Qm94PSIwIDAgMC40OCAwLjQ4IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wLjQgMC4xOEgwLjA0YTAuMDIgMC4wMiAwIDAgMCAtMC4wMiAwLjAydjAuMDhhMC4xOCAwLjE4IDAgMCAwIDAuMzU5IDAuMDJIMC40YTAuMDYgMC4wNiAwIDAgMCAwIC0wLjEyTTAuMiAwLjQyYTAuMTQgMC4xNCAwIDAgMSAtMC4xNCAtMC4xNHYtMC4wNmgwLjI4djAuMDZhMC4xNCAwLjE0IDAgMCAxIC0wLjE0IDAuMTRtMC4xOCAtMC4xNnYtMC4wNGMwLjAwNiAwLjAwMSAwLjA0IC0wLjAwNyAwLjA0IDAuMDIgMCAwLjAyNiAtMC4wMzUgMC4wMTkgLTAuMDQgMC4wMk0wLjA2NiAwLjEyNmwwLjAyNSAtMC4wMjVhMC4wNDggMC4wNDggMCAwIDEgLTAuMDEyIC0wLjAzMSAwLjA0MSAwLjA0MSAwIDAgMSAwLjAxMiAtMC4wMjlsMC4wMTUgLTAuMDE1YTAuMDIgMC4wMiAwIDAgMSAwLjAyOCAwLjAyOGwtMC4wMTUgMC4wMTVBMC4wNDggMC4wNDggMCAwIDEgMC4xMzEgMC4xYTAuMDQxIDAuMDQxIDAgMCAxIC0wLjAxMiAwLjAyOWwtMC4wMjUgMC4wMjVhMC4wMiAwLjAyIDAgMCAxIC0wLjAyOCAtMC4wMjhtMC4xIDAgMC4wMjUgLTAuMDI1YTAuMDQ4IDAuMDQ4IDAgMCAxIC0wLjAxMiAtMC4wMzEgMC4wNDEgMC4wNDEgMCAwIDEgMC4wMTIgLTAuMDI5bDAuMDE1IC0wLjAxNWEwLjAyIDAuMDIgMCAwIDEgMC4wMjggMC4wMjhsLTAuMDE1IDAuMDE1QTAuMDQ4IDAuMDQ4IDAgMCAxIDAuMjMxIDAuMWEwLjA0MSAwLjA0MSAwIDAgMSAtMC4wMTIgMC4wMjlsLTAuMDI1IDAuMDI1YTAuMDIgMC4wMiAwIDAgMSAtMC4wMjggLTAuMDI4bTAuMSAwIDAuMDI1IC0wLjAyNWEwLjA0OCAwLjA0OCAwIDAgMSAtMC4wMTIgLTAuMDMxIDAuMDQxIDAuMDQxIDAgMCAxIDAuMDEyIC0wLjAyOWwwLjAxNSAtMC4wMTVhMC4wMiAwLjAyIDAgMCAxIDAuMDI4IDAuMDI4bC0wLjAxNSAwLjAxNUEwLjA0OCAwLjA0OCAwIDAgMSAwLjMzMSAwLjFhMC4wNDEgMC4wNDEgMCAwIDEgLTAuMDEyIDAuMDI5bC0wLjAyNSAwLjAyNWEwLjAyIDAuMDIgMCAwIDEgLTAuMDI4IC0wLjAyOFoiLz48L3N2Zz4="
ICON_INACTIVE="PHN2ZyBmaWxsPSIjN2I3ZDdkIiB3aWR0aD0iMTZweCIgaGVpZ2h0PSIxNnB4IiB2aWV3Qm94PSIwIDAgMC40OCAwLjQ4IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wLjQgMC4xOEgwLjA0YTAuMDIgMC4wMiAwIDAgMCAtMC4wMiAwLjAydjAuMDhhMC4xOCAwLjE4IDAgMCAwIDAuMzU5IDAuMDJIMC40YTAuMDYgMC4wNiAwIDAgMCAwIC0wLjEyTTAuMiAwLjQyYTAuMTQgMC4xNCAwIDAgMSAtMC4xNCAtMC4xNHYtMC4wNmgwLjI4djAuMDZhMC4xNCAwLjE0IDAgMCAxIC0wLjE0IDAuMTRtMC4xOCAtMC4xNnYtMC4wNGMwLjAwNiAwLjAwMSAwLjA0IC0wLjAwNyAwLjA0IDAuMDIgMCAwLjAyNiAtMC4wMzUgMC4wMTkgLTAuMDQgMC4wMk0wLjA2NiAwLjEyNmwwLjAyNSAtMC4wMjVhMC4wNDggMC4wNDggMCAwIDEgLTAuMDEyIC0wLjAzMSAwLjA0MSAwLjA0MSAwIDAgMSAwLjAxMiAtMC4wMjlsMC4wMTUgLTAuMDE1YTAuMDIgMC4wMiAwIDAgMSAwLjAyOCAwLjAyOGwtMC4wMTUgMC4wMTVBMC4wNDggMC4wNDggMCAwIDEgMC4xMzEgMC4xYTAuMDQxIDAuMDQxIDAgMCAxIC0wLjAxMiAwLjAyOWwtMC4wMjUgMC4wMjVhMC4wMiAwLjAyIDAgMCAxIC0wLjAyOCAtMC4wMjhtMC4xIDAgMC4wMjUgLTAuMDI1YTAuMDQ4IDAuMDQ4IDAgMCAxIC0wLjAxMiAtMC4wMzEgMC4wNDEgMC4wNDEgMCAwIDEgMC4wMTIgLTAuMDI5bDAuMDE1IC0wLjAxNWEwLjAyIDAuMDIgMCAwIDEgMC4wMjggMC4wMjhsLTAuMDE1IDAuMDE1QTAuMDQ4IDAuMDQ4IDAgMCAxIDAuMjMxIDAuMWEwLjA0MSAwLjA0MSAwIDAgMSAtMC4wMTIgMC4wMjlsLTAuMDI1IDAuMDI1YTAuMDIgMC4wMiAwIDAgMSAtMC4wMjggLTAuMDI4bTAuMSAwIDAuMDI1IC0wLjAyNWEwLjA0OCAwLjA0OCAwIDAgMSAtMC4wMTIgLTAuMDMxIDAuMDQxIDAuMDQxIDAgMCAxIDAuMDEyIC0wLjAyOWwwLjAxNSAtMC4wMTVhMC4wMiAwLjAyIDAgMCAxIDAuMDI4IDAuMDI4bC0wLjAxNSAwLjAxNUEwLjA0OCAwLjA0OCAwIDAgMSAwLjMzMSAwLjFhMC4wNDEgMC4wNDEgMCAwIDEgLTAuMDEyIDAuMDI5bC0wLjAyNSAwLjAyNWEwLjAyIDAuMDIgMCAwIDEgLTAuMDI4IC0wLjAyOFoiLz48L3N2Zz4="

# caffeinate's modes to be used, described as arguments with respective description in a format "<argument>:<description>"
# modes with arguments, specified as "-" will NOT be used as commands but rather as menu/submenu titles
MODES=( 
		"-dim:⦿ Keep awake (system, display, disk)"           # keep the whole device awake along with all sub-systems (system, display, disk)
		"-dsm:⦿ Keep awake only on AC power"                  # the same with previous mode, but applies ONLY when device is running on AC power
		"-:---"
		"-:Prevent specific sub-system from sleeping"        # menu separator
		"-i:» Prevent system from idle sleeping"              # prevents only SYSTEM from sleeping (display and/or disk might fall into idle sleeping)
		"-s:» Prevent system from sleeping on AC power"       # the same with previous mode, but applies ONLY when device is running on AC power
		"-d:» Prevent display from sleeping"                  # prevents only DISPLAY from sleeping (system and/or disk might fall into idle sleeping)
		"-m:» Prevent disk from idle sleeping"                # prevents only DISK from sleeping (system and/or display might fall into idle sleeping)
	)

# Artificial wrapper for operating with $MODES constant
# Return caffeinate's mode arguments by splitting mode's line with ':' and returning only first part
# @param [String] -- string, describing caffeinate's mode, e.g.: "-di:Disable system & display idle sleeping"
# @return [String]
# @note ${var%Pattern} Remove from $var the shortest part of $Pattern that matches the back end of $var
#       ${var%%Pattern} Remove from $var the longest part of $Pattern that matches the back end of $var
function mode_arguments {
	mode = "$1"
	echo ${mode%%:*}
}

# Artificial wrapper for operating with $MODES constant
# Return caffeinate's mode description by splitting mode's line with ':' and returning only second part 
# @param [String] -- string, describing caffeinate's mode, e.g.: "-di:Disable system & display idle sleeping"
# @return [String]
# @note ${var#Pattern} Remove from $var the shortest part of $Pattern that matches the front end of $var.
#       ${var##Pattern} Remove from $var the longest part of $Pattern that matches the front end of $var.
#       With only one '#' character, the matching will stop on the first ":". That allows values to contain ":" too
function mode_description {
	mode = "$1"
	echo ${mode#*:}
}

# Artificial wrapper for operating with $MODES constant
# Returns caffeinate's mode description which corresponds to the arguments given
# @param [String] -- argument as described in caffeinate's mode string;
#                    e.g. if mode's string is "-di:Disable system & display idle sleeping", then argument should be "-di"
# @return [String] caffeinate's mode description which corresponds to the argument given;
#                  e.g. if mode's string is "-di:Disable system & display idle sleeping", 
#                  and argument "-di" is given as a parameter, function will return "Disable system & display idle sleeping"
function description_by_arguments {
	for mode in "${MODES[@]}" ; do
		if [[ $(mode_arguments ${mode}) = "$1" ]] 
		then
			echo $(mode_description ${mode})
		fi
	done
}

# Retrieve current caffeinate state
function caffeinate_state {
	ACTIVE=$(pgrep -l -f "caffeinate")
	if [[ $ACTIVE ]]
	then
		# split returned output, e.g.:
		# 45344 /usr/bin/caffeinate -di		
		PROCESS_CMD=(${ACTIVE// / })

		PROCESS_ARG=${PROCESS_CMD[2]}
		STATE=$(description_by_arguments $PROCESS_ARG)
		ICON=$ICON_ACTIVE
	else
		PROCESS_ARG=""
		STATE="Inactive"
		ICON=$ICON_INACTIVE
	fi
}

# Stop all caffeinate processes
function caffeinate_stop {
  /usr/bin/killall caffeinate &> /dev/null
}

# Start caffeinate utility with respective parameter(s)
# @note daemonize the process to properly refresh plugin's state afterwards
#       0<&- closes stdin
#       &> file sends stdout and stderr to a file
function caffeinate_start {
	nohup /usr/bin/caffeinate $1 0<&- &>/dev/null &
}

# proceed with caffeinate oprations if non-empty argument(s) were passed
if [[ -n "$1" ]]; then
	# stop existing instances if any
	caffeinate_stop
	# stop further execution if 'stop' argument was passed ...
	[[ "$1" = "stop" ]] && exit
	# ... or start caffeinate otherwise
	caffeinate_start $1
	exit
fi

# evaluate current caffeinate's state and update the icon
caffeinate_state

# render plugin's icon with corresponding state and dropdown menu with all modes
echo "|image='${ICON}'"
echo "---"
for mode in "${MODES[@]}" ; do
	if [[ "$(mode_arguments ${mode})" == "-" ]]; then
		echo "$(mode_description ${mode})"
	elif [[ "$(mode_arguments ${mode})" == "$PROCESS_ARG" ]]; then
		echo "[■ STOP] ${STATE/--/} | bash='$0' param1=stop terminal=false refresh=true color=${ACTIVE_MODE_COLOR}"
	else
		echo "$(mode_description ${mode}) | bash='$0' param1='$(mode_arguments ${mode})' terminal=false refresh=true"
	fi
done
echo "---"
