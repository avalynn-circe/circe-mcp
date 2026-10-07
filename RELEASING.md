# Releasing circe-mcp

## First publish (once, from a terminal)

npm can only attach a trusted publisher to a package that already exists, so version 0.1.0 is published by hand.

```sh
git clone https://github.com/avalynn-circe/circe-mcp
cd circe-mcp
npm ci
npm login
npm publish
```

`prepublishOnly` runs the type check and the tests, and `prepack` builds `dist/`, so the publish fails before anything is uploaded if either step fails. Then confirm it runs from a clean machine:

```sh
npx -y circe-mcp --version
```

## Turn on trusted publishing (once, on npmjs.com)

Open the package page, then Settings, then Trusted publishing. Add a GitHub Actions publisher with owner `avalynn-circe`, repository `circe-mcp`, workflow `publish.yml`, and no environment. The names are case-sensitive. After that, select the option that requires two-factor authentication and disallows tokens, so the workflow is the only publisher.

## Every later release

1. Bump the version in `package.json` and in `SERVER_VERSION` in `src/server.ts`. Commit.
2. Tag it and push: `git tag v0.2.0 && git push origin main v0.2.0`.
3. On GitHub, publish a release from the tag. The notes are the changelog.

The Publish workflow checks that the tag matches `package.json`, runs the type check and the tests, and publishes with provenance. A failed check publishes nothing.

## Registry listing

`package.json` carries `mcpName: io.github.avalynn-circe/circe-mcp`. The MCP Registry reads that field from the published npm package to confirm ownership, so it has to be in place before the first publish, and it already is.
