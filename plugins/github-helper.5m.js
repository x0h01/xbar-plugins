#!/usr/bin/env node

// <xbar.title>GitHub Helper v2</xbar.title>
// <xbar.version>v2.2</xbar.version>
// <xbar.author>Volodymyr Tereshchuk</xbar.author>
// <xbar.author.github>x0h01</xbar.author.github>
// <xbar.desc>Displays Github pull-requests and tickets related to current user</xbar.desc>
// <xbar.image>https://raw.githubusercontent.com/x0h01/xbar-plugins/master/screenshots/github-helper.png</xbar.image>
// <xbar.var>string(VAR_TOKEN=""): GitHub personal access token with repos scope</xbar.var>
// <xbar.var>string(VAR_USERNAME=""): GitHub username</xbar.var>
// <xbar.var>string(VAR_ENDPOINT="https://api.github.com"): GitHub API endpoint</xbar.var>
// <xbar.var>string(VAR_MAX_PAGES="5"): Number of 100-result pages to fetch (max results = this × 100)</xbar.var>
// <xbar.abouturl></xbar.abouturl>
//
// <swiftbar.hideAbout>true</swiftbar.hideAbout>
// <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
// <swiftbar.hideLastUpdated>false</swiftbar.hideLastUpdated>
// <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
// <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>
// <swiftbar.environment>[VAR_TOKEN=, VAR_USERNAME=, VAR_ENDPOINT=https://api.github.com, VAR_MAX_PAGES=5]</swiftbar.environment>

/* ----------------------
 * BEGIN of CONFIGURATION
 * ------------------- */
// repos to exclude from results
const EXCLUDE_REPOS = [];
// number of retry attempts on ENOTFOUND (network connectivity issues)
const RETRY_COUNT = 3;
// delay between retries in milliseconds (network connectivity issues)
const RETRY_DELAY_MS = 15000;
// GitHub GraphQL search hard-caps a single page at 100 nodes
const PAGE_SIZE = 100;
// fallback for VAR_MAX_PAGES if it's unset/invalid
const DEFAULT_MAX_PAGES = 5;
// ANSI colors for PR check counters (rendered with ansi=true)
const CHECK_COLORS = {
	passed: '\x1b[32m',  // green
	failed: '\x1b[31m',  // red
	running: '\x1b[90m', // gray
	reset: '\x1b[0m'
};
// terminal-notifier locations (SwiftBar's PATH may lack Homebrew); SwiftBar notifications are the fallback
const TERMINAL_NOTIFIER_PATHS = ['/opt/homebrew/bin/terminal-notifier', '/usr/local/bin/terminal-notifier'];
// last seen PR check counters, kept in SwiftBar's plugin data dir between runs
const CHECKS_STATE_FILE = 'checks-state.json';
// "Later" on the terminal-notifier install alert silences it for this long
const INSTALL_PROMPT_SNOOZE_MS = 24 * 60 * 60 * 1000;
// when the alert was last dismissed, kept in SwiftBar's plugin data dir
const INSTALL_PROMPT_FILE = 'install-prompt.json';
/* --------------------
 * END of CONFIGURATION
 * ----------------- */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// plugin's toolbar icon
const ICON = {
	NORMAL: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBMaWNlbnNlOiBNSVQuIE1hZGUgYnkgR2l0bGFiOiBodHRwczovL2dpdGxhYi5jb20vZ2l0bGFiLW9yZy9naXRsYWItc3Zncz9yZWY9aWNvbmR1Y2suY29tIC0tPgo8c3ZnIHdpZHRoPSIxOHB4IiBoZWlnaHQ9IjE4cHgiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTcuOTc2IDBBNy45NzcgNy45NzcgMCAwMDAgNy45NzZjMCAzLjUyMiAyLjMgNi41MDcgNS40MzEgNy41ODQuMzkyLjA0OS41MzgtLjE5Ni41MzgtLjM5MnYtMS4zN2MtMi4yMDEuNDktMi42OS0xLjA3Ni0yLjY5LTEuMDc2LS4zNDMtLjkzLS44ODEtMS4xNzUtLjg4MS0xLjE3NS0uNzM0LS40ODkuMDQ4LS40ODkuMDQ4LS40ODkuNzgzLjA0OSAxLjIyNC44MzIgMS4yMjQuODMyLjczNCAxLjIyMyAxLjg1OS44OCAyLjMuNjg1LjA0OC0uNTM4LjI5My0uODguNDg5LTEuMDc2LTEuNzYyLS4xOTYtMy42MjEtLjg4MS0zLjYyMS0zLjk2NCAwLS44OC4yOTMtMS41NjYuODMyLTIuMTUzLS4wNS0uMTQ3LS4zNDMtLjk3OC4wOTgtMi4wNTUgMCAwIC42ODUtLjE5NiAyLjIwMS44MzIuNjM2LS4xOTYgMS4zMjItLjI0NSAyLjAwNy0uMjQ1czEuMzcuMDk4IDIuMDA2LjI0NWMxLjUxNy0xLjAyNyAyLjIwMi0uODMyIDIuMjAyLS44MzIuNDQgMS4wNzcuMTQ2IDEuOTA4LjA5NyAyLjEwNGEzLjE2IDMuMTYgMCAwMS44MzIgMi4xNTNjMCAzLjA4My0xLjg2IDMuNzE5LTMuNjIgMy45MTUuMjkzLjI0NC41MzguNzMzLjUzOCAxLjQ2N3YyLjIwMmMwIC4xOTYuMTQ2LjQ0LjUzOC4zOTJBNy45ODQgNy45ODQgMCAwMDE2IDcuOTc2QzE1Ljk1MSAzLjU3MiAxMi4zOCAwIDcuOTc2IDB6IiBmaWxsPSIjN2I3ZDdkIi8+Cjwvc3ZnPg==',
	ACTIVE: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBMaWNlbnNlOiBNSVQuIE1hZGUgYnkgR2l0bGFiOiBodHRwczovL2dpdGxhYi5jb20vZ2l0bGFiLW9yZy9naXRsYWItc3Zncz9yZWY9aWNvbmR1Y2suY29tIC0tPgo8c3ZnIHdpZHRoPSIxOHB4IiBoZWlnaHQ9IjE4cHgiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTcuOTc2IDBBNy45NzcgNy45NzcgMCAwMDAgNy45NzZjMCAzLjUyMiAyLjMgNi41MDcgNS40MzEgNy41ODQuMzkyLjA0OS41MzgtLjE5Ni41MzgtLjM5MnYtMS4zN2MtMi4yMDEuNDktMi42OS0xLjA3Ni0yLjY5LTEuMDc2LS4zNDMtLjkzLS44ODEtMS4xNzUtLjg4MS0xLjE3NS0uNzM0LS40ODkuMDQ4LS40ODkuMDQ4LS40ODkuNzgzLjA0OSAxLjIyNC44MzIgMS4yMjQuODMyLjczNCAxLjIyMyAxLjg1OS44OCAyLjMuNjg1LjA0OC0uNTM4LjI5My0uODguNDg5LTEuMDc2LTEuNzYyLS4xOTYtMy42MjEtLjg4MS0zLjYyMS0zLjk2NCAwLS44OC4yOTMtMS41NjYuODMyLTIuMTUzLS4wNS0uMTQ3LS4zNDMtLjk3OC4wOTgtMi4wNTUgMCAwIC42ODUtLjE5NiAyLjIwMS44MzIuNjM2LS4xOTYgMS4zMjItLjI0NSAyLjAwNy0uMjQ1czEuMzcuMDk4IDIuMDA2LjI0NWMxLjUxNy0xLjAyNyAyLjIwMi0uODMyIDIuMjAyLS44MzIuNDQgMS4wNzcuMTQ2IDEuOTA4LjA5NyAyLjEwNGEzLjE2IDMuMTYgMCAwMS44MzIgMi4xNTNjMCAzLjA4My0xLjg2IDMuNzE5LTMuNjIgMy45MTUuMjkzLjI0NC41MzguNzMzLjUzOCAxLjQ2N3YyLjIwMmMwIC4xOTYuMTQ2LjQ0LjUzOC4zOTJBNy45ODQgNy45ODQgMCAwMDE2IDcuOTc2QzE1Ljk1MSAzLjU3MiAxMi4zOCAwIDcuOTc2IDB6IiBmaWxsPSIjZjhmOWY5Ii8+Cjwvc3ZnPg==',
	// same octocat silhouette as NORMAL/ACTIVE, just recolored red — deliberately not
	// template-rendered (see the image= vs templateImage= usage in the catch block),
	// so this stays visibly red instead of the OS stripping it to a white outline
	ERROR: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBMaWNlbnNlOiBNSVQuIE1hZGUgYnkgR2l0bGFiOiBodHRwczovL2dpdGxhYi5jb20vZ2l0bGFiLW9yZy9naXRsYWItc3Zncz9yZWY9aWNvbmR1Y2suY29tIC0tPgo8c3ZnIHdpZHRoPSIxOHB4IiBoZWlnaHQ9IjE4cHgiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTcuOTc2IDBBNy45NzcgNy45NzcgMCAwMDAgNy45NzZjMCAzLjUyMiAyLjMgNi41MDcgNS40MzEgNy41ODQuMzkyLjA0OS41MzgtLjE5Ni41MzgtLjM5MnYtMS4zN2MtMi4yMDEuNDktMi42OS0xLjA3Ni0yLjY5LTEuMDc2LS4zNDMtLjkzLS44ODEtMS4xNzUtLjg4MS0xLjE3NS0uNzM0LS40ODkuMDQ4LS40ODkuMDQ4LS40ODkuNzgzLjA0OSAxLjIyNC44MzIgMS4yMjQuODMyLjczNCAxLjIyMyAxLjg1OS44OCAyLjMuNjg1LjA0OC0uNTM4LjI5My0uODguNDg5LTEuMDc2LTEuNzYyLS4xOTYtMy42MjEtLjg4MS0zLjYyMS0zLjk2NCAwLS44OC4yOTMtMS41NjYuODMyLTIuMTUzLS4wNS0uMTQ3LS4zNDMtLjk3OC4wOTgtMi4wNTUgMCAwIC42ODUtLjE5NiAyLjIwMS44MzIuNjM2LS4xOTYgMS4zMjItLjI0NSAyLjAwNy0uMjQ1czEuMzcuMDk4IDIuMDA2LjI0NWMxLjUxNy0xLjAyNyAyLjIwMi0uODMyIDIuMjAyLS44MzIuNDQgMS4wNzcuMTQ2IDEuOTA4LjA5NyAyLjEwNGEzLjE2IDMuMTYgMCAwMS44MzIgMi4xNTNjMCAzLjA4My0xLjg2IDMuNzE5LTMuNjIgMy45MTUuMjkzLjI0NC41MzguNzMzLjUzOCAxLjQ2N3YyLjIwMmMwIC4xOTYuMTQ2LjQ0LjUzOC4zOTJBNy45ODQgNy45ODQgMCAwMDE2IDcuOTc2QzE1Ljk1MSAzLjU3MiAxMi4zOCAwIDcuOTc2IDB6IiBmaWxsPSIjZmYzYjMwIi8+Cjwvc3ZnPg=='
};

// plugin's theme icons for dark and light modes
const THEME = {
	DARK: {
		REQUESTED: 'PHN2ZyB3aWR0aD0iMTZweCIgaGVpZ2h0PSIxNnB4IiB2aWV3Qm94PSIwIDAgMC4zMiAwLjMyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9IiMwMGZmMDAiPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMC4xMTIgMC4wOTlhMC4wNSAwLjA1IDAgMCAxIC0wLjAyMiAwLjAxOGMtMC4wMDMgMC4wMDEgLTAuMDA5IDAuMDAzIC0wLjAwOSAwLjAwM3YwLjFhMC4wNSAwLjA1IDAgMCAxIDAuMDMyIDAuMDIxYzAuMDA1IDAuMDA4IDAuMDA4IDAuMDE4IDAuMDA4IDAuMDI4IDAgMC4wMDcgLTAuMDAxIDAuMDE0IC0wLjAwNCAwLjAyQTAuMDUgMC4wNSAwIDAgMSAwLjA3IDAuMzJhMC4wNSAwLjA1IDAgMCAxIC0wLjAyOCAtMC4wMDhBMC4wNSAwLjA1IDAgMCAxIDAuMDIxIDAuMjZjMC4wMDIgLTAuMDEgMC4wMDcgLTAuMDE5IDAuMDE0IC0wLjAyNiAwLjAwNyAtMC4wMDcgMC4wMTYgLTAuMDEyIDAuMDI1IC0wLjAxNFYwLjExOWEwLjA1MiAwLjA1MiAwIDAgMSAtMC4wMjUgLTAuMDE0IDAuMDUgMC4wNSAwIDAgMSAtMC4wMTQgLTAuMDI2IDAuMDUgMC4wNSAwIDAgMSAwLjAyMSAtMC4wNTFBMC4wNSAwLjA1IDAgMCAxIDAuMDcgMC4wMmEwLjA1IDAuMDUgMCAwIDEgMC4wMzYgMC4wMTUgMC4wNSAwLjA1IDAgMCAxIDAuMDE1IDAuMDM2YzAgMC4wMSAtMC4wMDMgMC4wMiAtMC4wMDggMC4wMjhtLTAuMDE1IDAuMTU3YTAuMDMgMC4wMyAwIDAgMCAtMC4wMTEgLTAuMDEyIDAuMDI5IDAuMDI5IDAgMCAwIC0wLjAxNSAtMC4wMDQgMC4wMyAwLjAzIDAgMCAwIC0wLjAyOSAwLjAzNiAwLjAzIDAuMDMgMCAwIDAgMC4wMjQgMC4wMjRjMC4wMDYgMC4wMDEgMC4wMTIgMC4wMDEgMC4wMTcgLTAuMDAyIDAuMDA2IC0wLjAwMiAwLjAxIC0wLjAwNiAwLjAxNCAtMC4wMTEgMC4wMDMgLTAuMDA1IDAuMDA1IC0wLjAxIDAuMDA1IC0wLjAxNWEwLjAzIDAuMDMgMCAwIDAgLTAuMDA0IC0wLjAxNk0wLjA1NCAwLjA5NWMwLjAwNSAwLjAwMyAwLjAxMSAwLjAwNSAwLjAxNyAwLjAwNSAwLjAwNSAwIDAuMDExIC0wLjAwMiAwLjAxNSAtMC4wMDRhMC4wMyAwLjAzIDAgMCAwIDAuMDE1IC0wLjAyNyAwLjAzIDAuMDMgMCAwIDAgLTAuMDA1IC0wLjAxNSAwLjAzMSAwLjAzMSAwIDAgMCAtMC4wMTQgLTAuMDExIDAuMDMgMC4wMyAwIDAgMCAtMC4wMTcgLTAuMDAyIDAuMDMgMC4wMyAwIDAgMCAtMC4wMjQgMC4wMjRjLTAuMDAxIDAuMDA2IC0wLjAwMSAwLjAxMiAwLjAwMiAwLjAxNyAwLjAwMiAwLjAwNiAwLjAwNiAwLjAxIDAuMDExIDAuMDE0TTAuMjYxIDAuMTRoLTAuMDJWMC4xMWEwLjAzIDAuMDMgMCAwIDAgLTAuMDMgLTAuMDNIMC4xNzRsMC4wMjUgMC4wMjUgLTAuMDE0IDAuMDE0TDAuMTQyIDAuMDc3di0wLjAxNGwwLjA0MyAtMC4wNDMgMC4wMTQgMC4wMTQgLTAuMDI1IDAuMDI1aDAuMDM3YTAuMDUgMC4wNSAwIDAgMSAwLjA0NiAwLjAzMWMwLjAwMyAwLjAwNiAwLjAwNCAwLjAxMyAwLjAwNCAwLjAxOXpNMC4yNiAwLjMyaC0wLjAydi0wLjA2SDAuMTh2LTAuMDJoMC4wNlYwLjE4aDAuMDJ2MC4wNmgwLjA2djAuMDJoLTAuMDZ6Ii8+PC9zdmc+',
		OPENED: 'PHN2ZyB3aWR0aD0iMTZweCIgaGVpZ2h0PSIxNnB4IiB2aWV3Qm94PSIwIDAgMC4zMiAwLjMyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9IiMwMGZmMDAiPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMC4xMTIgMC4wOTlhMC4wNSAwLjA1IDAgMCAxIC0wLjAyMiAwLjAxOGMtMC4wMDMgMC4wMDEgLTAuMDA5IDAuMDAzIC0wLjAwOSAwLjAwM3YwLjFhMC4wNSAwLjA1IDAgMCAxIDAuMDMyIDAuMDIxYzAuMDA1IDAuMDA4IDAuMDA4IDAuMDE4IDAuMDA4IDAuMDI4IDAgMC4wMDcgLTAuMDAxIDAuMDE0IC0wLjAwNCAwLjAyQTAuMDUgMC4wNSAwIDAgMSAwLjA3IDAuMzJhMC4wNSAwLjA1IDAgMCAxIC0wLjAyOCAtMC4wMDhBMC4wNSAwLjA1IDAgMCAxIDAuMDIxIDAuMjZjMC4wMDIgLTAuMDEgMC4wMDcgLTAuMDE5IDAuMDE0IC0wLjAyNiAwLjAwNyAtMC4wMDcgMC4wMTYgLTAuMDEyIDAuMDI1IC0wLjAxNFYwLjExOWEwLjA1MiAwLjA1MiAwIDAgMSAtMC4wMjUgLTAuMDE0IDAuMDUgMC4wNSAwIDAgMSAtMC4wMTQgLTAuMDI2IDAuMDUgMC4wNSAwIDAgMSAwLjAyMSAtMC4wNTFBMC4wNSAwLjA1IDAgMCAxIDAuMDcgMC4wMmEwLjA1IDAuMDUgMCAwIDEgMC4wMzYgMC4wMTUgMC4wNSAwLjA1IDAgMCAxIDAuMDE1IDAuMDM2YzAgMC4wMSAtMC4wMDMgMC4wMiAtMC4wMDggMC4wMjhtLTAuMDE1IDAuMTU3YTAuMDMgMC4wMyAwIDAgMCAtMC4wMTEgLTAuMDEyIDAuMDI5IDAuMDI5IDAgMCAwIC0wLjAxNSAtMC4wMDQgMC4wMyAwLjAzIDAgMCAwIC0wLjAyOSAwLjAzNiAwLjAzIDAuMDMgMCAwIDAgMC4wMjQgMC4wMjRjMC4wMDYgMC4wMDEgMC4wMTIgMC4wMDEgMC4wMTcgLTAuMDAyIDAuMDA2IC0wLjAwMiAwLjAxIC0wLjAwNiAwLjAxNCAtMC4wMTEgMC4wMDMgLTAuMDA1IDAuMDA1IC0wLjAxIDAuMDA1IC0wLjAxNWEwLjAzIDAuMDMgMCAwIDAgLTAuMDA0IC0wLjAxNk0wLjA1NCAwLjA5NWMwLjAwNSAwLjAwMyAwLjAxMSAwLjAwNSAwLjAxNyAwLjAwNSAwLjAwNSAwIDAuMDExIC0wLjAwMiAwLjAxNSAtMC4wMDRhMC4wMyAwLjAzIDAgMCAwIDAuMDE1IC0wLjAyNyAwLjAzIDAuMDMgMCAwIDAgLTAuMDA1IC0wLjAxNSAwLjAzMSAwLjAzMSAwIDAgMCAtMC4wMTQgLTAuMDExIDAuMDMgMC4wMyAwIDAgMCAtMC4wMTcgLTAuMDAyIDAuMDMgMC4wMyAwIDAgMCAtMC4wMjQgMC4wMjRjLTAuMDAxIDAuMDA2IC0wLjAwMSAwLjAxMiAwLjAwMiAwLjAxNyAwLjAwMiAwLjAwNiAwLjAwNiAwLjAxIDAuMDExIDAuMDE0bTAuMjA3IDAuMTI2YzAuMDEgMC4wMDIgMC4wMTggMC4wMDcgMC4wMjUgMC4wMTQgMC4wMDkgMC4wMDkgMC4wMTUgMC4wMjIgMC4wMTQgMC4wMzUgMCAwLjAxIC0wLjAwMyAwLjAyIC0wLjAwOCAwLjAyOGEwLjA1IDAuMDUgMCAwIDEgLTAuMDkxIC0wLjAxOCAwLjA1IDAuMDUgMCAwIDEgMC4wMjEgLTAuMDUxYzAuMDA1IC0wLjAwNCAwLjAxMSAtMC4wMDYgMC4wMTggLTAuMDA3VjAuMTFhMC4wMyAwLjAzIDAgMCAwIC0wLjAzIC0wLjAzSDAuMTc0bDAuMDI1IDAuMDI1IC0wLjAxNCAwLjAxNEwwLjE0MiAwLjA3N3YtMC4wMTRsMC4wNDMgLTAuMDQzIDAuMDE0IDAuMDE0IC0wLjAyNSAwLjAyNWgwLjAzN2EwLjA1IDAuMDUgMCAwIDEgMC4wNDYgMC4wMzFjMC4wMDMgMC4wMDYgMC4wMDQgMC4wMTMgMC4wMDQgMC4wMTl6bTAuMDExIDAuMDdhMC4wMyAwLjAzIDAgMCAwIDAuMDA0IC0wLjAzOCAwLjAzMSAwLjAzMSAwIDAgMCAtMC4wMTQgLTAuMDExIDAuMDMgMC4wMyAwIDAgMCAtMC4wMTcgLTAuMDAyIDAuMDMgMC4wMyAwIDAgMCAtMC4wMjQgMC4wMjQgMC4wMyAwLjAzIDAgMCAwIDAuMDAyIDAuMDE3IDAuMDMgMC4wMyAwIDAgMCAwLjA0OSAwLjAxeiIvPjwvc3ZnPg==',
		REFRESH: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBMaWNlbnNlOiBNSVQuIE1hZGUgYnkgamF5bmV3ZXk6IGh0dHBzOi8vZ2l0aHViLmNvbS9qYXluZXdleS9jaGFybS1pY29ucyAtLT4KPHN2ZyB3aWR0aD0iMTZweCIgaGVpZ2h0PSIxNnB4IiB2aWV3Qm94PSIwIDAgMTYgMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPgo8cGF0aCBkPSJtNS43NSAxNC4yNXMtLjUtMiAuNS0zYzAgMC0yIDAtMy41LTEuNXMtMS00LjUgMC01LjVjLS41LTEuNS41LTIuNS41LTIuNXMxLjUgMCAyLjUgMWMxLS41IDMuNS0uNSA0LjUgMCAxLTEgMi41LTEgMi41LTFzMSAxIC41IDIuNWMxIDEgMS41IDQgMCA1LjVzLTMuNSAxLjUtMy41IDEuNWMxIDEgLjUgMyAuNSAzIi8+CjxwYXRoIGQ9Im01LjI1IDEzLjc1Yy0xLjUuNS0zLS41LTMuNS0xIi8+Cjwvc3ZnPg==',
		TICKET: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBmb2N1c2FibGU9ImZhbHNlIiBhcmlhLWxhYmVsPSJPcGVuIGlzc3VlIiBjbGFzcz0ib2N0aWNvbiBvY3RpY29uLWlzc3VlLW9wZW5lZCBPY3RpY29uLXNjLTlrYXlrOS0wIGNSeUJLSSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMTYgMTYiIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgZmlsbD0iY3VycmVudENvbG9yIiBkaXNwbGF5PSJpbmxpbmUtYmxvY2siIG92ZXJmbG93PSJ2aXNpYmxlIiBzdHlsZT0idmVydGljYWwtYWxpZ246IHRleHQtYm90dG9tOyI+PHBhdGggZD0iTTggOS41YTEuNSAxLjUgMCAxIDAgMC0zIDEuNSAxLjUgMCAwIDAgMCAzWiIgZmlsbD0iIzAwZmYwMCI+PC9wYXRoPjxwYXRoIGQ9Ik04IDBhOCA4IDAgMSAxIDAgMTZBOCA4IDAgMCAxIDggMFpNMS41IDhhNi41IDYuNSAwIDEgMCAxMyAwIDYuNSA2LjUgMCAwIDAtMTMgMFoiIGZpbGw9IiMwMGZmMDAiPjwvcGF0aD48L3N2Zz4=',
		REPO_COLOR: '#00FF00'
	},
	LIGHT: {
		REQUESTED: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBMaWNlbnNlOiBNSVQuIE1hZGUgYnkgTWljcm9zb2Z0OiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS1jb2RpY29ucyAtLT4KPHN2ZyB3aWR0aD0iMTZweCIgaGVpZ2h0PSIxNnB4IiB2aWV3Qm94PSIwIDAgMTYgMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iIzFBN0YzNyI+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01LjYxNiA0LjkyOGEyLjQ4NyAyLjQ4NyAwIDAgMS0xLjExOS45MjJjLS4xNDguMDYtLjQ1OC4xMzgtLjQ1OC4xMzh2NS4wMDhhMi41MSAyLjUxIDAgMCAxIDEuNTc5IDEuMDYyYy4yNzMuNDEyLjQxOS44OTUuNDE5IDEuMzg4LjAwOC4zNDMtLjA1Ny42ODQtLjE5IDFBMi40ODUgMi40ODUgMCAwIDEgMy41IDE1Ljk4NGEyLjQ4MiAyLjQ4MiAwIDAgMS0xLjM4OC0uNDE5QTIuNDg3IDIuNDg3IDAgMCAxIDEuMDUgMTNjLjA5NS0uNDg2LjMzMS0uOTMyLjY4LTEuMjgzLjM0OS0uMzQzLjc5LS41NzkgMS4yNjktLjY4VjUuOTQ5YTIuNiAyLjYgMCAwIDEtMS4yNjktLjY4IDIuNTAzIDIuNTAzIDAgMCAxLS42OC0xLjI4MyAyLjQ4NyAyLjQ4NyAwIDAgMSAxLjA2LTIuNTY1QTIuNDkgMi40OSAwIDAgMSAzLjUgMWEyLjUwNCAyLjUwNCAwIDAgMSAxLjgwNy43MjkgMi40OTMgMi40OTMgMCAwIDEgLjcyOSAxLjgxYy4wMDIuNDk0LS4xNDQuOTc4LS40MiAxLjM4OXptLS43NTYgNy44NjFhMS41IDEuNSAwIDAgMC0uNTUyLS41NzkgMS40NSAxLjQ1IDAgMCAwLS43Ny0uMjEgMS40OTUgMS40OTUgMCAwIDAtMS40NyAxLjc5IDEuNDkzIDEuNDkzIDAgMCAwIDEuMTggMS4xNzljLjI4OC4wNTguNTg2LjAzLjg2LS4wOC4yNzYtLjExNy41MTItLjMxMi42OC0uNTYuMTUtLjIyNi4yMzUtLjQ5LjI0OS0uNzZhMS41MSAxLjUxIDAgMCAwLS4xNzctLjc4ek0yLjcwOCA0Ljc0MWMuMjQ3LjE2MS41MzYuMjUuODMuMjUuMjcxIDAgLjUzOC0uMDc1Ljc3LS4yMTFhMS41MTQgMS41MTQgMCAwIDAgLjcyOS0xLjM1OSAxLjUxMyAxLjUxMyAwIDAgMC0uMjUtLjc2IDEuNTUxIDEuNTUxIDAgMCAwLS42OC0uNTYgMS40OSAxLjQ5IDAgMCAwLS44Ni0uMDggMS40OTQgMS40OTQgMCAwIDAtMS4xNzkgMS4xOGMtLjA1OC4yODgtLjAzLjU4Ni4wOC44Ni4xMTcuMjc2LjMxMi41MTIuNTYuNjh6TTEzLjAzNyA3aC0xLjAwMlY1LjQ5YTEuNSAxLjUgMCAwIDAtMS41LTEuNUg4LjY4N2wxLjI2OSAxLjI3LS43MS43MDlMNy4xMTcgMy44NHYtLjdsMi4xMy0yLjEzLjcxLjcxMS0xLjI2OSAxLjI3aDEuODVhMi40ODQgMi40ODQgMCAwIDEgMi4zMTIgMS41NDFjLjEyNS4zMDIuMTg5LjYyOC4xODcuOTU3Vjd6TTEzIDE2aC0xdi0zSDl2LTFoM1Y5aDF2M2gzdjFoLTN2M3oiLz48L3N2Zz4=',
		OPENED: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBMaWNlbnNlOiBNSVQuIE1hZGUgYnkgTWljcm9zb2Z0OiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS1jb2RpY29ucyAtLT4KPHN2ZyB3aWR0aD0iMTZweCIgaGVpZ2h0PSIxNnB4IiB2aWV3Qm94PSIwIDAgMTYgMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iIzFBN0YzNyI+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01LjYxNiA0LjkyOGEyLjQ4NyAyLjQ4NyAwIDAgMS0xLjExOS45MjJjLS4xNDguMDYtLjQ1OC4xMzgtLjQ1OC4xMzh2NS4wMDhhMi41MSAyLjUxIDAgMCAxIDEuNTc5IDEuMDYyYy4yNzMuNDEyLjQxOS44OTUuNDE5IDEuMzg4LjAwOC4zNDMtLjA1Ny42ODQtLjE5IDFBMi40ODUgMi40ODUgMCAwIDEgMy41IDE1Ljk4NGEyLjQ4MiAyLjQ4MiAwIDAgMS0xLjM4OC0uNDE5QTIuNDg3IDIuNDg3IDAgMCAxIDEuMDUgMTNjLjA5NS0uNDg2LjMzMS0uOTMyLjY4LTEuMjgzLjM0OS0uMzQzLjc5LS41NzkgMS4yNjktLjY4VjUuOTQ5YTIuNiAyLjYgMCAwIDEtMS4yNjktLjY4IDIuNTAzIDIuNTAzIDAgMCAxLS42OC0xLjI4MyAyLjQ4NyAyLjQ4NyAwIDAgMSAxLjA2LTIuNTY1QTIuNDkgMi40OSAwIDAgMSAzLjUgMWEyLjUwNCAyLjUwNCAwIDAgMSAxLjgwNy43MjkgMi40OTMgMi40OTMgMCAwIDEgLjcyOSAxLjgxYy4wMDIuNDk0LS4xNDQuOTc4LS40MiAxLjM4OXptLS43NTYgNy44NjFhMS41IDEuNSAwIDAgMC0uNTUyLS41NzkgMS40NSAxLjQ1IDAgMCAwLS43Ny0uMjEgMS40OTUgMS40OTUgMCAwIDAtMS40NyAxLjc5IDEuNDkzIDEuNDkzIDAgMCAwIDEuMTggMS4xNzljLjI4OC4wNTguNTg2LjAzLjg2LS4wOC4yNzYtLjExNy41MTItLjMxMi42OC0uNTYuMTUtLjIyNi4yMzUtLjQ5LjI0OS0uNzZhMS41MSAxLjUxIDAgMCAwLS4xNzctLjc4ek0yLjcwOCA0Ljc0MWMuMjQ3LjE2MS41MzYuMjUuODMuMjUuMjcxIDAgLjUzOC0uMDc1Ljc3LS4yMTFhMS41MTQgMS41MTQgMCAwIDAgLjcyOS0xLjM1OSAxLjUxMyAxLjUxMyAwIDAgMC0uMjUtLjc2IDEuNTUxIDEuNTUxIDAgMCAwLS42OC0uNTYgMS40OSAxLjQ5IDAgMCAwLS44Ni0uMDggMS40OTQgMS40OTQgMCAwIDAtMS4xNzkgMS4xOGMtLjA1OC4yODgtLjAzLjU4Ni4wOC44Ni4xMTcuMjc2LjMxMi41MTIuNTYuNjh6bTEwLjMyOSA2LjI5NmMuNDguMDk3LjkyMi4zMzUgMS4yNjkuNjguNDY2LjQ3LjcyOSAxLjEwNy43MjUgMS43NjYuMDAyLjQ5My0uMTQ0Ljk3Ny0uNDIgMS4zODhhMi40OTkgMi40OTkgMCAwIDEtNC41MzItLjg5OSAyLjUgMi41IDAgMCAxIDEuMDY3LTIuNTY1Yy4yNjctLjE4My41NzEtLjMwOC44ODktLjM3VjUuNDg5YTEuNSAxLjUgMCAwIDAtMS41LTEuNDk5SDguNjg3bDEuMjY5IDEuMjctLjcxLjcwOUw3LjExNyAzLjg0di0uN2wyLjEzLTIuMTMuNzEuNzExLTEuMjY5IDEuMjdoMS44NWEyLjQ4NCAyLjQ4NCAwIDAgMSAyLjMxMiAxLjU0MWMuMTI1LjMwMi4xODkuNjI4LjE4Ny45NTd2NS41NDh6bS41NTcgMy41MDlhMS40OTMgMS40OTMgMCAwIDAgLjE5MS0xLjg5IDEuNTUyIDEuNTUyIDAgMCAwLS42OC0uNTU5IDEuNDkgMS40OSAwIDAgMC0uODYtLjA4IDEuNDkzIDEuNDkzIDAgMCAwLTEuMTc5IDEuMTggMS40OSAxLjQ5IDAgMCAwIC4wOC44NiAxLjQ5NiAxLjQ5NiAwIDAgMCAyLjQ0OC40OXoiLz48L3N2Zz4=',
		REFRESH: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBMaWNlbnNlOiBNSVQuIE1hZGUgYnkgamF5bmV3ZXk6IGh0dHBzOi8vZ2l0aHViLmNvbS9qYXluZXdleS9jaGFybS1pY29ucyAtLT4KPHN2ZyB3aWR0aD0iMTZweCIgaGVpZ2h0PSIxNnB4IiB2aWV3Qm94PSIwIDAgMTYgMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxLjUiPgo8cGF0aCBkPSJtNS43NSAxNC4yNXMtLjUtMiAuNS0zYzAgMC0yIDAtMy41LTEuNXMtMS00LjUgMC01LjVjLS41LTEuNS41LTIuNS41LTIuNXMxLjUgMCAyLjUgMWMxLS41IDMuNS0uNSA0LjUgMCAxLTEgMi41LTEgMi41LTFzMSAxIC41IDIuNWMxIDEgMS41IDQgMCA1LjVzLTMuNSAxLjUtMy41IDEuNWMxIDEgLjUgMyAuNSAzIi8+CjxwYXRoIGQ9Im01LjI1IDEzLjc1Yy0xLjUuNS0zLS41LTMuNS0xIi8+Cjwvc3ZnPg==',
		TICKET: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBmb2N1c2FibGU9ImZhbHNlIiBhcmlhLWxhYmVsPSJPcGVuIGlzc3VlIiBjbGFzcz0ib2N0aWNvbiBvY3RpY29uLWlzc3VlLW9wZW5lZCBPY3RpY29uLXNjLTlrYXlrOS0wIGNSeUJLSSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMTYgMTYiIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgZmlsbD0iY3VycmVudENvbG9yIiBkaXNwbGF5PSJpbmxpbmUtYmxvY2siIG92ZXJmbG93PSJ2aXNpYmxlIiBzdHlsZT0idmVydGljYWwtYWxpZ246IHRleHQtYm90dG9tOyI+PHBhdGggZD0iTTggOS41YTEuNSAxLjUgMCAxIDAgMC0zIDEuNSAxLjUgMCAwIDAgMCAzWiIgZmlsbD0iIzFBN0YzNyI+PC9wYXRoPjxwYXRoIGQ9Ik04IDBhOCA4IDAgMSAxIDAgMTZBOCA4IDAgMCAxIDggMFpNMS41IDhhNi41IDYuNSAwIDEgMCAxMyAwIDYuNSA2LjUgMCAwIDAtMTMgMFoiIGZpbGw9IiMxQTdGMzciPjwvcGF0aD48L3N2Zz4=',
		REPO_COLOR: '#1B7F38'
	}
};

// detect current theme to be used with plugin
const CURRENT_THEME = (process.env.OS_APPEARANCE == 'Dark' || process.env.XBARDarkMode === 'true') ? THEME.DARK : THEME.LIGHT;

// GraphQL search returns Issue and PullRequest nodes together.
const SEARCH_QUERY = `
query($searchQuery: String!, $first: Int!, $after: String) {
	search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
		pageInfo { hasNextPage endCursor }
		nodes {
			__typename
			... on Issue {
				title
				url
				author { login }
				assignees(first: 20) { nodes { login } }
				repository { nameWithOwner }
			}
			... on PullRequest {
				title
				url
				author { login }
				repository { nameWithOwner }
				commits(last: 1) {
					nodes {
						commit {
							statusCheckRollup {
								# counts cover all contexts regardless of first:, so no paging needed
								contexts(first: 1) {
									checkRunCountsByState { state count }
									statusContextCountsByState { state count }
								}
							}
						}
					}
				}
			}
		}
	}
}`;

/**
 * Makes an HTTP POST request to the specified URL with the provided headers and body.
 * @param {string} url - The URL to send the POST request to.
 * @param {Object} headers - An object containing HTTP headers to include in the request.
 * @param {string} body - The raw request body string.
 * @returns {Promise<string>} - A promise that resolves with the response data as a string.
 * @throws {Error} - Throws an error if the request fails or times out.
 */
function httpPost(url, headers, body) {
	const TIMEOUT_DELAY = 20000;

	function attempt(retriesLeft) {
		return new Promise((resolve, reject) => {
			let data = '';
			const parsedUrl = new URL(url);
			const options = {
				hostname: parsedUrl.hostname,
				path: parsedUrl.pathname,
				method: 'POST',
				headers: {
					...headers,
					'Content-Length': Buffer.byteLength(body)
				}
			};

			const req = https.request(options, response => {
				response.on('data', chunk => data += chunk);
				response.on('error', error => { clearTimeout(timer); reject(error); });
				// resolve only on HTTP 200; treat anything else as a hard failure (e.g. 401, 404)
				response.on('end', () => {
					clearTimeout(timer);
					response.statusCode === 200 ? resolve(data) : reject(`${response.statusCode} ${response.statusMessage}`);
				});
			});
			req.on('error', error => { clearTimeout(timer); reject(error); });

			// abort and reject if the server doesn't respond within the timeout
			const timer = setTimeout(() => {
				req.destroy();
				reject(new Error('HTTP_CALL_TIMEDOUT'));
			}, TIMEOUT_DELAY);

			req.write(body);
			req.end();
		}).catch(error => {
			// ENOTFOUND means DNS resolution failed — wifi likely isn't up yet at system startup.
			// Wait and retry; all other errors (auth, not found, timeout) are propagated immediately.
			if (retriesLeft > 0 && error && error.code === 'ENOTFOUND') {
				return new Promise(r => setTimeout(r, RETRY_DELAY_MS)).then(() => attempt(retriesLeft - 1));
			}
			throw error;
		});
	}

	return attempt(RETRY_COUNT);
}

/**
 * Builds the GitHub search qualifier string, applying repo exclusions and sort order.
 * @returns {string}
 */
function buildSearchQueryString() {
	let query = 'is:open involves:@me sort:created-desc';
	EXCLUDE_REPOS.forEach(repo => { query += ` -repo:${repo}`; });
	return query;
}

/**
 * Queries the GitHub GraphQL API.
 * @param {string} query - The GraphQL query document.
 * @param {Object} variables - The GraphQL variables for the query.
 * @returns {Promise<Object>} - The `data` portion of the JSON response.
 * @throws {Error} - Throws if the GraphQL response carries an `errors` array.
 */
function githubGraphQL(query, variables) {
	const headers = {
		'Authorization': `Bearer ${process.env.VAR_TOKEN}`,
		'User-Agent': 'xbar-app-github-helper-plus',
		'Content-Type': 'application/json'
	};
	const body = JSON.stringify({ query, variables });
	const url = `${process.env.VAR_ENDPOINT}/graphql`;
	return httpPost(url, headers, body).then(JSON.parse).then(response => {
		if (response.errors?.length) {
			throw new Error(response.errors.map(e => e.message).join('; '));
		}
		return response.data;
	});
}

/**
 * Fetches search nodes, paging through GraphQL's 100-per-page cap up to VAR_MAX_PAGES.
 * @returns {Promise<Array<Object>>}
 */
async function fetchSearchNodes() {
	const maxPages = Math.max(1, parseInt(process.env.VAR_MAX_PAGES, 10) || DEFAULT_MAX_PAGES);
	const searchQuery = buildSearchQueryString();
	let nodes = [];
	let after = null;

	for (let page = 0; page < maxPages; page++) {
		const data = await githubGraphQL(SEARCH_QUERY, { searchQuery, first: PAGE_SIZE, after });
		nodes = nodes.concat(data.search.nodes);
		if (!data.search.pageInfo.hasNextPage) break;
		after = data.search.pageInfo.endCursor;
	}

	return nodes;
}

// maps CheckRunState / StatusState values onto the three displayed buckets
const CHECK_BUCKETS = {
	SUCCESS: 'passed', NEUTRAL: 'passed', SKIPPED: 'passed',
	FAILURE: 'failed', ERROR: 'failed', TIMED_OUT: 'failed', CANCELLED: 'failed',
	ACTION_REQUIRED: 'failed', STARTUP_FAILURE: 'failed',
	QUEUED: 'running', IN_PROGRESS: 'running', PENDING: 'running', WAITING: 'running',
	REQUESTED: 'running', EXPECTED: 'running'
};

/**
 * Sums check runs and commit statuses of the PR's head commit into passed/failed/running buckets.
 * @param {Object} pr - The PullRequest search node.
 * @returns {Object|null} - `{ passed, failed, running }`, or null if the PR has no checks.
 */
function summarizeChecks(pr) {
	const contexts = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts;
	if (!contexts) return null;
	const counts = { passed: 0, failed: 0, running: 0 };
	[...contexts.checkRunCountsByState, ...contexts.statusContextCountsByState].forEach(({ state, count }) => {
		const bucket = CHECK_BUCKETS[state];
		if (bucket) counts[bucket] += count;
	});
	return counts;
}

/**
 * Formats check counters as an ANSI-colored string, skipping zero buckets.
 * @param {Object|null} checks - The result of summarizeChecks().
 * @param {Object} colors - Color codes to use; pass NO_COLORS for plain text.
 * @returns {string}
 */
function formatChecks(checks, colors = CHECK_COLORS) {
	if (!checks) return '';
	const parts = [
		checks.passed && `${colors.passed}✓ ${checks.passed}${colors.reset}`,
		checks.failed && `${colors.failed}✗ ${checks.failed}${colors.reset}`,
		checks.running && `${colors.running}○ ${checks.running}${colors.reset}`
	].filter(Boolean);
	return parts.length ? `  ${parts.join('  ')}` : '';
}

const NO_COLORS = { passed: '', failed: '', running: '', reset: '' };

/**
 * Shows a notification that opens the given URL on click. Prefers terminal-notifier, because
 * clicking a SwiftBar notification also pops SwiftBar's "already running" dialog; falls back to
 * SwiftBar's URL scheme if terminal-notifier is missing or blocked (non-zero exit).
 * @param {string} title
 * @param {string} subtitle
 * @param {string} body
 * @param {string} url - Opened on click; also groups notifications per PR (terminal-notifier only).
 * @returns {void}
 */
function notify(title, subtitle, body, url) {
	for (const bin of TERMINAL_NOTIFIER_PATHS) {
		if (!fs.existsSync(bin)) continue;
		try {
			execFileSync(bin, ['-title', title, '-subtitle', subtitle, '-message', body, '-open', url, '-group', url], { stdio: 'ignore' });
			return;
		} catch (e) {
			// e.g. notifications turned off for terminal-notifier — fall back to SwiftBar
		}
	}
	const params = new URLSearchParams({ plugin: process.env.SWIFTBAR_PLUGIN_PATH, title, subtitle, body, href: url });
	// URLSearchParams encodes spaces as '+', which SwiftBar would show literally
	execFileSync('open', ['-g', `swiftbar://notify?${params.toString().replace(/\+/g, '%20')}`], { stdio: 'ignore' });
}

/**
 * Asks (via an osascript alert) to install terminal-notifier. "Install" runs brew in a Terminal
 * window and then opens Notifications settings, since terminal-notifier must be allowed there;
 * "Later" (or no answer within 2 minutes) silences the alert for INSTALL_PROMPT_SNOOZE_MS.
 * @returns {void}
 */
function offerTerminalNotifierInstall() {
	const dataDir = process.env.SWIFTBAR_PLUGIN_DATA_PATH;
	const promptFile = path.join(dataDir, INSTALL_PROMPT_FILE);
	try {
		if (Date.now() - JSON.parse(fs.readFileSync(promptFile, 'utf8')).dismissedAt < INSTALL_PROMPT_SNOOZE_MS) return;
	} catch (e) {
		// never dismissed
	}

	// strings go in via argv, so no AppleScript escaping is needed
	const answer = execFileSync('osascript', [
		'-e', 'on run argv',
		'-e', 'display alert (item 1 of argv) message (item 2 of argv) buttons {"Later", "Install"} default button "Install" as informational giving up after 120',
		'-e', 'end run',
		'terminal-notifier is not installed',
		'GitHub Helper uses it for PR check notifications. Without it, clicking a notification also shows SwiftBar\'s "already running" dialog.\n\nInstall it with Homebrew?'
	], { encoding: 'utf8' });

	if (!answer.includes('button returned:Install')) {
		fs.writeFileSync(promptFile, JSON.stringify({ dismissedAt: Date.now() }));
		return;
	}

	// a .command file opens in Terminal without needing Automation permission;
	// launching the app once is what makes terminal-notifier show up in Notifications settings
	const script = path.join(dataDir, 'install-terminal-notifier.command');
	fs.writeFileSync(script, [
		'#!/bin/zsh -l',
		'brew install terminal-notifier || exit 1',
		'open -a "$(brew --prefix terminal-notifier)/terminal-notifier.app" --args -title "terminal-notifier installed" -message "Allow its notifications in System Settings"',
		'open "x-apple.systempreferences:com.apple.Notifications-Settings.extension"',
		'echo "\\nDone. In Notifications settings, select terminal-notifier and turn on Allow Notifications."',
		`rm -f "${script}"`
	].join('\n'), { mode: 0o755 });
	execFileSync('open', [script]);
}

/**
 * Compares PR check counters with the previous run and notifies when a new failure appears
 * or when all running checks finish. Only active under SwiftBar (needs its plugin data dir);
 * the first run just records the state without notifying.
 * @param {Object} items - The result of structured().
 * @returns {void}
 */
function notifyCheckChanges(items) {
	const dataDir = process.env.SWIFTBAR_PLUGIN_DATA_PATH;
	if (!dataDir || !process.env.SWIFTBAR_PLUGIN_PATH) return;
	const stateFile = path.join(dataDir, CHECKS_STATE_FILE);

	let previous = null;
	try {
		previous = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
	} catch (e) {
		// no state yet (first run) or unreadable — record current counters without notifying
	}

	const current = {};
	let notified = false;
	for (const repos of Object.values(items?.pr || {})) {
		for (const [repo, prs] of Object.entries(repos)) {
			prs.forEach(pr => {
				if (!pr.checks) return;
				current[pr.html_url] = pr.checks;
				const prev = previous?.[pr.html_url];
				if (!prev) return;

				let title;
				if (prev.running > 0 && pr.checks.running === 0) {
					title = pr.checks.failed ? '✗ Checks finished with failures' : '✓ Checks passed';
				} else if (pr.checks.failed > prev.failed) {
					title = '✗ Checks failing';
				}
				if (title) {
					const number = pr.html_url.split('/').pop();
					notify(title, `${repo}#${number}`, `${pr.title}\n${formatChecks(pr.checks, NO_COLORS).trim()}`, pr.html_url);
					notified = true;
				}
			});
		}
	}

	fs.mkdirSync(dataDir, { recursive: true });
	fs.writeFileSync(stateFile, JSON.stringify(current));

	// after state is saved and the fallback notifications are out, since the alert blocks until answered
	if (notified && !TERMINAL_NOTIFIER_PATHS.some(bin => fs.existsSync(bin))) {
		offerTerminalNotifierInstall();
	}
}

/**
 * Converts GraphQL search nodes to the structured object, organized by type (issue or pr), category, repo.
 * @param {Array<Object>} nodes - The GraphQL search result nodes.
 * @returns {Object}
 */
function structured(nodes) {
	return nodes.reduce((sum, item) => {
		const repo = item.repository.nameWithOwner;
		const type = item.__typename === 'PullRequest' ? 'pr' : 'issue';
		const author = item.author?.login;
		let category;
		// for the simplisity, use similar status 'assigned' for the pr where review is requested;
		// the logic can be extended or adjusted going forward if more complex conditions will be required
		if (type === 'pr') {
			// for the PR check author first to properly categorize it as "opened by" vs "assigned"
			category = (author === process.env.VAR_USERNAME) ? 'created' : 'assigned';
		} else {
			const assignees = item.assignees.nodes.map(a => a.login);
			if (assignees.includes(process.env.VAR_USERNAME)) {
				category = 'assigned';
			} else if (author === process.env.VAR_USERNAME) {
				category = 'created';
			} else {
				category = 'mentioned';
			}
		}
		// add <type> (pr or issue)
		sum[type] ??= {};
		// for each <type> add <category> (created, assigned, etc)
		sum[type][category] ??= {};
		// for each <category> add <repo>
		sum[type][category][repo] ??= [];
		// push issue to the particular <repo>
		sum[type][category][repo].push({
			title: item.title,
			html_url: item.url,
			author,
			checks: type === 'pr' ? summarizeChecks(item) : null
		});
		return sum;
	}, {});
}

/**
Creates plugin's sub-menu from the data returned by GitHub API.
@param {Object} data - The data returned by GitHub API, structured as an object with repository names as keys and arrays of items as values.
@return {string} - The formatted sub-menu string for the plugin.
*/
function composeMenu(data) {
	const menu = [];
	for (const [repository, items] of Object.entries(data)) {
		// repo name
		const menuEntities = [`--${repository} | disabled=true color=${CURRENT_THEME.REPO_COLOR}  size=12`];
		// build repo entities
		items.forEach(item => {
			const checks = formatChecks(item.checks);
			// ansi=true only when needed, so plain lines keep SwiftBar's default rendering
			menuEntities.push(`--☉ ${item.title} / by @${item.author}${checks} | href=${item.html_url}${checks ? ' ansi=true' : ''}`);
		});
		// push entities to the menu
		menu.push(menuEntities.join('\n'));
	}
	return menu.join('\n');
}

/**
 * Prints out the formatted string to the plugin's menu if non-empty one is provided
 * @param {string} string - The string to print out.
 * @returns {void}
 */
const render = string => string && console.log(string);

(async function () {
	try {
		const items = structured(await fetchSearchNodes());

		try {
			notifyCheckChanges(items);
		} catch (e) {
			// a notification problem must not break the menu
		}

		const hasItems = Object.keys(items).length > 0;
		render(`| templateImage=${hasItems ? ICON.ACTIVE : ICON.NORMAL}`);

		render('---');

		const prRequested = composeMenu(items?.pr?.assigned || {});
		render(`To Review | image="${CURRENT_THEME.REQUESTED}"`);
		render(prRequested);

		const prCreated = composeMenu(items?.pr?.created || {});
		render(`Opened | image="${CURRENT_THEME.OPENED}"`);
		render(prCreated);

		render('---');

		const tkCreated = composeMenu(items?.issue?.created || {});
		render(`Filed | image="${CURRENT_THEME.TICKET}"`);
		render(tkCreated);

		const ticketsAssigned = composeMenu(items?.issue?.assigned || {});
		render(`Assigned | image="${CURRENT_THEME.TICKET}"`);
		render(ticketsAssigned);

		const ticketsMentioned = composeMenu(items?.issue?.mentioned || {});
		render(`Involved | image="${CURRENT_THEME.TICKET}"`);
		render(ticketsMentioned);
	} catch (e) {
		// image= (not templateImage=) so the red actually shows — templateImage discards
		// color entirely and renders using only the shape's alpha as a system-tinted mask
		render(`| image=${ICON.ERROR}`);
		render('---');
		render('⚠️ Error fetching data');
		render('---');
		render(`${e} | size=12`);
	} finally {
		// finally render refresh button and exit
		render('---');
		render(`Refresh | image="${CURRENT_THEME.REFRESH}" refresh=true`);

		process.exit(0);
	}
})();
