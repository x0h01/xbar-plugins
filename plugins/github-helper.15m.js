#!/usr/bin/env node

// <xbar.title>GitHub Helper</xbar.title>
// <xbar.version>v2.0</xbar.version>
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
/* --------------------
 * END of CONFIGURATION
 * ----------------- */

const https = require('https');

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
		sum[type][category][repo].push({ title: item.title, html_url: item.url, author });
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
		items.forEach(item => menuEntities.push(`--☉ ${item.title} / by @${item.author} | href=${item.html_url}`));
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
