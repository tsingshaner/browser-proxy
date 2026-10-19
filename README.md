# Browser Tookits

A Manifest V3 proxy extension for Chromium and Firefox. Built with TypeScript,
React, CRXJS, shadcn/ui (Base UI), Tailwind CSS, i18next and LogTape in a pnpm workspace.

## Develop and build

Use Node.js 24.11+ (24.x), pnpm **12.11.2**, and `zip` for release packaging.

```sh
pnpm install --frozen-lockfile
pnpm check:type
pnpm test
pnpm build
```

- `pnpm dev`: Chromium development server.
- `pnpm dev:firefox`: Firefox development server.
- `pnpm release`: build both browsers and create `dist/chromium-release.zip` and
  `dist/firefox-release.zip`. This does not sign or publish the extension.
- `packages/core`: validated configuration, domain routing, simple PAC generation
  and backup migration; compiled by tsdown.
- `apps/extension`: background controller and React popup/settings.
  Feature implementations and their tests live in `src/features/`; page HTML and
  React entry points live in `src/options/` and `src/popup/`.

Load `apps/extension/dist` as an unpacked extension in Chrome 120+.
For Firefox 140+, open `about:debugging` → This Firefox → Load Temporary Add-on
and choose `apps/extension/dist-firefox/manifest.json`. In `about:addons`, allow
Browser Tookits in private windows: Firefox requires this permission to change
proxy settings, which affect regular and private windows. Normal Firefox
installation requires Mozilla signing; temporary installation is for development.

## UI components

The popup and settings use the shadcn/ui Base Nova components in
`apps/extension/src/components/ui`, backed by `@base-ui/react`. Shared theme
tokens live in `src/style.css`. All extension pages follow the system light/dark
appearance automatically, including native form controls; `components.json` configures future shadcn additions.
Native Select preserves browser form submission; tabs and mode radios use Base UI
keyboard and focus behavior. Component sources are adapted from the
[official registry](https://ui.shadcn.com/docs/components/base/button), with the
[MIT notice](apps/extension/public/THIRD-PARTY-NOTICES.txt) included in both builds.

## Configure

Manage fixed HTTP, HTTPS, SOCKS4 and SOCKS5 proxies in settings, then select a
connection in the popup. Choose **Open settings in side panel** to keep the full
configuration page beside the current site (Chromium side panel or Firefox sidebar).
**Manage proxies** still opens settings in a tab. Both views share the same saved
configuration and revision checks. HTTP/HTTPS proxy credentials are stored locally and sent
only to the selected proxy's authentication challenge. SOCKS authentication is not
supported. The popup reports rejected credentials.

Domain rules accept exact domains and `*.example.com` (subdomains only). The first
matching rule wins; use the keyboard-accessible Move up/Move down buttons to change
priority. Domains ignore case and trailing dots and normalize international names
to ASCII. Rule profiles can reference fixed proxies, direct connections or other
rule profiles, with a default connection at each level. Cycles, missing references
and nesting beyond 32 levels are rejected. Save or reload edits before switching
rule profiles. Concurrent edits are rejected instead of overwriting newer data.

The popup shows the current tab's latest 1,000 requests in the current background
session, including failures and requests exceeding 30 seconds. Failure does not
prove a proxy problem. A failed domain opens a draft rule in settings; choose its
target and save. You can change it to a wildcard manually. No public-suffix or
registrable-domain inference is performed. Navigation and background restarts
reset transient monitoring state.

Diagnostic logs use an isolated native IndexedDB store. They retain the most recent
30 days, at most 5,000 entries and at most 5 MB of serialized UTF-8 data. Settings
shows the latest 200 records and can export all retained records or clear them.
Only allowlisted diagnostic messages are persisted, without arbitrary properties,
credentials or full configurations. Storage failures do not block proxy switching.

## Path redirect

In settings, open **Path redirect** to replace an HTTPS source site root with a
different HTTPS destination ending in `/`. For example, `https://source.example/repo?q=1`
becomes `https://destination.example/git/repo?q=1`. Only top-level GET requests
match; embedded frames, assets, POST requests and other sites are unaffected. Credentials,
non-default ports, query parameters and fragments are not allowed in configured
addresses. The feature is off by default and works independently of proxy mode.

Save and grant source-site access to enable; **Disable now** removes the rule even
if stored addresses are invalid. Settings persist locally as `pathRedirect`,
separately from proxy backups. When migrating from Browser Toolkit, re-enter the
addresses and disable its old redirect before enabling this one. The old extension
and its data are not modified.

## Migrate configuration

Export your original configuration and historical logs before upgrading. Keep these
files: the new extension does not automatically import or delete old storage or
remote synchronization data. Load only one proxy extension at a time to avoid
competing for control.

Backup & restore exports JSON **including plaintext proxy passwords**. Keep backups
private. Import validates the entire supported graph and shows unsupported content
before you choose whether to import only the supported part. Invalid data and stale
revisions do not replace settings. Legacy schema-2 JSON / `.bak` supports fixed
proxies, multiple SwitchProfile rules, and supported VirtualProfile references.
Legacy imports start in System mode for route inspection. Legacy wildcard apex
matching is preserved using separate exact and subdomain rules.

Subscriptions, Gist/WebDAV synchronization, IP/CIDR conditions, arbitrary PAC,
regular expressions, legacy bypass lists and protocol-specific fixed-proxy layouts
are not supported. Unsupported profiles, rules and settings are reported rather
than silently activated. Subscription caches are not converted, synchronization
credentials are not activated, and old logs are not automatically copied. Export
historical logs from the old version if needed. New configuration continues using
the `proxyConfig` key and the earlier `proxyMode` fallback.

See [migration decisions](docs/migration-scope.md) and
[GitHub Issues](https://github.com/tsingshaner/browser-proxy/issues).

## License and attribution

Derived from ZeroOmega / SwitchyOmega. Copyright notices and contributor credits
are preserved in [AUTHORS](AUTHORS) and [COPYING](COPYING).
Licensed under GNU GPL version 3 or later, without warranty. This project does not
provide proxy servers or a VPN service and is not affiliated with proxy providers.
