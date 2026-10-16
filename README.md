ZeroOmega, forked from SwitchyOmega compatible with manifest v3
============

[Chrome Web Store](https://chromewebstore.google.com/detail/pfnededegaaopdmhkdmcofjmoldfiped)

[Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/zeroomegaproxy-switchy-/dmaldhchmoafliphkijbfhaomcgglmgd)

[Firefox Addon](https://addons.mozilla.org/en-US/firefox/addon/zeroomega/)

Manage and switch between multiple proxies quickly & easily.

[![Translation status](https://hosted.weblate.org/widgets/switchyomega/-/svg-badge.svg)](https://hosted.weblate.org/engage/switchyomega/?utm_source=widget)

Chromium Extension
------------------
The project is available as a Chromium Extension.

You can try it on [Chrome Web Store](https://chromewebstore.google.com/detail/pfnededegaaopdmhkdmcofjmoldfiped),
or grab a packaged extension file (CRX) for offline installation on the [Releases page](https://github.com/zero-peak/ZeroOmega/releases).

Please [report issues on the issue tracker](https://github.com/zero-peak/ZeroOmega/issues).

Firefox Addon
----------------------------

There is also a WebExtension port, which allows installing in Firefox. Compatibility with Firefox has increased significantly recently.

You can try it on [Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/zeroomega/),
or grab a packaged extension file (XPI) for offline installation on the [Releases page](https://github.com/zero-peak/ZeroOmega/releases).

Please [report issues on the issue tracker](https://github.com/zero-peak/ZeroOmega/issues), browser-specific bugs are possible.

Development status
------------------

## PAC generator
This project contains a PAC generating module called `omega-pac`, which handles
the profiles model and compile profiles into PAC scripts. This module is standalone
and can be published to npm when the documentation is ready.

## Options manager
The folder `omega-target` contains browser-independent logic for managing the
options and applying profiles. Every public method is well documented in the comments.
Functions related to browser are not included, and shall be implemented in subclasses
of the `omega-target` classes.

`omega-web` is a web-based configuration interface for various options and profiles.
The interface works great with `omega-target` as the back-end.

`omega-web` alone is incomplete and requires a file named `omega_target_web.js`
containing an angular module `omegaTarget`. The module contains browser-dependent
code to communicate with `omega-target` back-end, and other code retrieving
browser-related state and information.
See the `omega-target-chromium-extension/omega_target_web.coffee` file for an
example of such module.

## Targets
The `omega-target-*` folders should contain environment-dependent code such as
browser API calls.

Each target folder should contain an extended `OmegaTarget` object, which
contains subclasses of the abstract base classes like `Options`. The classes
contains implementation of the abstract methods, and can override other methods
at will.

A target can copy the files in `omega-web` into its build to provide a web-based
configuration interface. If so, the target must provide the `omega_target_web.js`
file as described in the Options manager section.

Additionally, each target can contain other files and resources required for the
target, such as background pages and extension manifests.

For now, only one target has been implemented: The WebExtension target.
This target allows the project to be used as a Chromium extension in most
Chromium-based browsers and also as a Firefox Addon as mentioned above.

## Translation

Translation is hosted on Weblate. If you want to help improve the translated
text or start translation for your language, please follow the link of the picture
below.

本项目翻译由Weblate托管。如果您希望帮助改进翻译，或将本项目翻译成一种新的语言，请
点击下方图片链接进入翻译。

[![Translation status](https://hosted.weblate.org/widgets/switchyomega/-/287x66-white.png)](https://hosted.weblate.org/engage/switchyomega/?utm_source=widget)

## Building the project

The migration workspace requires Node.js 24.11+ (24.x) and pnpm 12.11.2.
Enable pnpm with Corepack (`corepack enable`), then run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` builds the new TypeScript core with tsdown, the React extension with
CRXJS, and then the existing
extension with Grunt. Load `omega-target-chromium-extension/build` as an unpacked
extension. The first legacy build downloads its frontend assets through Bower;
GitHub network access is required. `pnpm legacy:assets` can prefetch those assets.
The pnpm lockfile covers npm dependencies; legacy Bower assets retain their old
resolution mechanism until the React migration removes them.

- `pnpm build:modern`: build the core package and new Chromium/Firefox extensions.
- `pnpm --filter @browser-proxy/extension dev`: run the Chromium CRXJS development server.
- `pnpm --filter @browser-proxy/extension dev:firefox`: run the Firefox CRXJS development server.
- `pnpm build:legacy`: build the existing extension without `npm link`.
- `pnpm test:modern`: run Vitest behavior checks.
- `pnpm test:legacy`: run the existing PAC and configuration-sync suites.
- `pnpm release:legacy`: package the previously built extension into `dist`.
- `pnpm --filter omega-build exec grunt watch`: watch the legacy modules.

The new `@browser-proxy/core` and `@browser-proxy/extension` workspaces coexist
with the old packages. Load `apps/extension/dist` for the new Chromium extension (Chrome 120+).
For Firefox 140+, load `apps/extension/dist-firefox/manifest.json` via
`about:debugging` → This Firefox → Load Temporary Add-on. In `about:addons`,
allow Browser Proxy to run in private windows: Firefox requires this permission
to change proxy settings, which affect both regular and private windows.
Temporary installation is for development; normal distribution requires Mozilla signing.
It supports direct/system modes and HTTP, HTTPS, SOCKS4, and SOCKS5 fixed proxies.
HTTP/HTTPS proxy authentication is supported; credentials stay in local extension storage.
The popup reports rejected credentials. Chromium does not support SOCKS username/password authentication.
Use the popup’s Manage proxies button to create or edit servers in the options page.
Select Domain rules in the options page to edit exact domain routes and a default connection,
then select Domain rules in the popup to activate them. Domains are case-insensitive,
ignore a trailing dot, and normalize international names to ASCII. Exact domains match only themselves;
`*.example.com` matches only subdomains. The first match wins; use Move up/Move down
to change priority, then save. IP/CIDR, paths, regular expressions, and other wildcard positions are rejected.
Concurrent edits are rejected with a reload prompt; switch away before deleting an active proxy.
Backup & restore exports plain JSON including passwords; keep the file private. Imports
show a preview, validate before saving, and reject stale revisions. Legacy schema-2 JSON
(`.bak`) imports fixed proxies and one simple switch profile; unsupported rules, bypasses,
profiles, and settings are reported before explicit partial import. Legacy imports start
in System mode so routes can be reviewed. Keep the original backup for unsupported content.
New configuration uses versioned, isolated local storage;
legacy profiles are never imported automatically. Load only one proxy extension at a time
to avoid competing for proxy control. Existing storage keys
and browser protocols are unchanged. Internal dependencies use `workspace:*`.


License
-------
![GPLv3](https://www.gnu.org/graphics/gplv3-127x51.png)

ZeroOmega is licensed under [GNU General Public License](https://www.gnu.org/licenses/gpl.html) Version 3 or later.

ZeroOmega is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

ZeroOmega is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with ZeroOmega.  If not, see <http://www.gnu.org/licenses/>.

Notice
------


ZeroOmega currently does not have a dedicated project homepage. Please refer to this Github repository and wiki for official information.

ZeroOmega is not cooperating with any proxy providers, VPN providers or ISPs at the moment. No advertisement is displayed in ZeroOmega project or software. Proxy providers are welcome to recommend ZeroOmega as part of the solution in tutorials, but it must be made clear that ZeroOmega is an independent project, is not affiliated with the provider and therefore cannot provide any support on network connections or proxy technology.

重要声明
--------

ZeroOmega 目前没有专门的项目主页。一切信息请以 Github 上的项目和 wiki 为准。

ZeroOmega 目前未与任何代理提供商、VPN提供商或 ISP 达成任何合作协议，项目或软件中不包含任何此类广告。欢迎代理提供商在教程或说明中推荐 ZeroOmega ，但请明确说明此软件是独立项目，与代理提供商无关，且不提供任何关于网络连接或代理技术的支持。
