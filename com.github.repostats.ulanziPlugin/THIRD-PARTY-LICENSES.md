# Third-Party Licenses

This plugin bundles the following third-party libraries and fonts, plus one
public API. Each is the property of its respective authors.

## Libraries

| Component | Use | License | Copyright |
|-----------|-----|---------|-----------|
| `opentype.js` | Vector glyph rendering (the numbers as real font paths) | MIT | © 2020 Frederik De Bleser |
| `ws` (`node_modules/ws`) | WebSocket client for the Ulanzi SDK channel | MIT | © 2011 Einar Otto Stangvik and contributors |
| `libs/node/*`, `libs/js/*` | Ulanzi UlanziDeck SDK | © Ulanzi | © Ulanzi Technology |

## Fonts (`assets/fonts/`)

| File | Family | License | Copyright |
|------|--------|---------|-----------|
| `sans.ttf` | Roboto | Apache License 2.0 | © 2011 Google Inc. |
| `mono.ttf` | Roboto Mono | Apache License 2.0 | © 2015 Google Inc. |
| `serif.ttf` | Roboto Slab | Apache License 2.0 | © 2011 Google Inc. |
| `display.ttf` | Orbitron | SIL Open Font License 1.1 | © 2009 Matt McInerney |

## Data source — GitHub REST API

Repository statistics are read from the **GitHub REST API**
(`https://api.github.com`). Unauthenticated requests are rate-limited by GitHub
(~60/hour); supplying your own personal access token raises this and allows
private repositories. The token is stored only in the action's local settings and
is sent solely to api.github.com over HTTPS — it is never logged or sent anywhere
else. GitHub® is a trademark of GitHub, Inc.; this plugin is not affiliated with
or endorsed by GitHub. No telemetry.

---

## MIT License (opentype.js, ws)

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the above copyright notice and this permission
notice being included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

## SIL Open Font License 1.1 — Orbitron

Copyright (c) 2009, Matt McInerney (matt@pixelspread.com), with Reserved Font
Name "Orbitron". Licensed under the SIL Open Font License, Version 1.1 —
https://openfontlicense.org
