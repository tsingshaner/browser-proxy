# Remaining migration scope

The three follow-up tickets in `docs/migration-tickets` are approved and published.
All three capabilities are implemented. The log retention/capacity and historical-log
handling below are approved requirements.

GitHub issue #9 confirms that subscriptions and Gist/WebDAV synchronization are
removed from the new product. Request monitoring, nested profiles, and persistent
logs remain required before issue #10 can remove the legacy implementation.

## Dependency inventory

| Dependency | Remaining legacy callers | New implementation / removal condition |
| --- | --- | --- |
| jsondiffpatch | Options patch application, settings editor, rule editor, configuration synchronization | New settings submit concrete profiles or full rule lists with revision checks. New import also uses a validated snapshot. Remove after the old editors and synchronization are deleted. |
| limiter | Token bucket in configuration synchronization | No new synchronization feature. Remove with the legacy synchronization implementation. |
| heap | Request monitor timeout queue | Migrate bounded monitoring with Map and timestamps, then remove the old queue and heap. |
| idb-keyval | Persistent log store, last-error record, synchronization store, reset/debug actions | New logs use native IndexedDB and Promise. Remove only after logs migrate and old synchronization/debug entry points are retired. |

The legacy callers and all four dependencies have now been removed. The new
workspaces use native revision checks, Map, Promise and IndexedDB. The final cleanup
also removes CoffeeScript, AngularJS, Grunt, Bower, Bluebird, uglify-js, tldjs,
ip-address and xhr. No automatic registrable-domain inference remains, so no
public-suffix dependency is needed.

## Data handling

- Modern JSON backup restores credentials, rule order, defaults, and selected mode
  under optimistic revision checks. Unsupported fields are reported before a
  partial import can replace existing configuration.
- Legacy schema-2 JSON imports supported fixed proxies, multiple switch profiles and virtual references.
  Unsupported bypass lists, protocol-specific proxy layouts, IP/CIDR conditions,
  advanced PAC profiles, subscriptions, and settings are listed before confirmation.
  Imports start in System mode for review; they never silently activate a changed
  routing graph. Original backup files remain the recovery source.
- Legacy wildcard apex behavior is preserved by explicit apex and subdomain rules.
  Multiple/nested switch profiles now preserve references and rule priority; cycles,
  missing targets and nesting beyond 32 levels are rejected.
- Subscription caches are not converted automatically. Sync credentials are not
  imported or activated. Removing the feature does not delete an existing user's
  original backup or remote sync data.
- Request monitor caches are transient and are not migrated.
- Persistent log migration retains the most recent 30 days, with limits of
  5,000 entries / 5 MB, and uses an isolated store. Historical legacy text logs are
  not automatically copied; users can export them in the old version. Legacy
  IndexedDB data is not deleted during source cleanup.

## Remaining vertical slices

1. [#11 Request monitoring](https://github.com/tsingshaner/browser-proxy/issues/11): browser events → bounded session state → popup status and
   failed-domain rule editing; depends on domain ordering and Firefox support.
2. [#12 Nested profiles](https://github.com/tsingshaner/browser-proxy/issues/12): versioned graph → editor/import → route and authentication
   resolution in both browsers; depends on JSON migration and Firefox support.
3. [#13 Persistent logs](https://github.com/tsingshaner/browser-proxy/issues/13): LogTape → bounded IndexedDB sink → view/export/clear UI;
   depends on authentication and Firefox support.

Each slice blocks issue #10 through a native GitHub dependency. Final cleanup removes
legacy source and build entry points after these capabilities have passed boundary
tests and real Chromium/Firefox checks. Browser storage and remote data are not deleted.
The old generator parity fixture is retained as explicit expected routing results.
