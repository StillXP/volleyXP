# Vendored Lock In packages

`lockin-*.tgz` are built copies of `@lockin/tokens`, `@lockin/icons` and `@lockin/react`
from the Lock In design system repo (<https://github.com/StillXP/lock-in-design-system>).

They live here because the root `package.json` used to point at a folder beside this
repo on one machine (`file:../../Design System Lock In/...`). That folder doesn't exist
on Vercel or in a fresh clone, so installs ended up with dangling links and every build
failed with `Cannot find module '@lockin/tokens'`.

## Updating them

After changing the design system:

```sh
npm run vendor:lockin          # rebuilds and repacks, and updates package.json
npm install                    # updates package-lock.json
```

then commit `vendor/`, `package.json` and `package-lock.json`. The script expects the
Lock In repo at `../../Design System Lock In`; pass another path as an argument if yours
is elsewhere.

## Later

Publishing the packages to npm would replace this folder with ordinary version ranges.
