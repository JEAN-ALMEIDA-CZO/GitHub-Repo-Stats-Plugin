[![Available on Ulanzi Community Store](https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/docs/badges/ulanzi-community-store.svg)](https://ulanzicommunitystore.narlei.com)

<div align="center">
<p align="center">
  <img src="com.github.repostats.ulanziPlugin/assets/marketing/Banner.jpeg" alt="GitHub RepoStats Deck Plugin" width="100%">
  <img src="com.github.repostats.ulanziPlugin/assets/marketing/brand.png" alt="GitHub RepoStats Deck Plugin" width="20%">
</p>

**Live GitHub monitors on your Ulanzi Deck — seven actions, one plugin.**

Stars, releases, commits, CI status, issues & PRs, profiles and your API quota — each on its own key. Press the key to cycle through the metrics.

![version](https://img.shields.io/badge/version-1.0.0-58a6ff)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-0d1117)
![langs](https://img.shields.io/badge/i18n-11%20languages-3fb950)
![license](https://img.shields.io/badge/license-MIT-a78bfa)

</div>

---

## ✨ Seven actions

Each action is a separate key with its own icon. The key shows **one metric at a time, big and centered** — **press the key to cycle** to the next.

| Action | What it shows | Cycle (press the key) |
|--------|---------------|-----------------------|
| <img src="com.github.repostats.ulanziPlugin/assets/icons/action-repo.svg" alt="GitHub RepoStats Deck Plugin" width="8%"> **Repo Stats** | Any public repo | stars → forks → issues → watchers |
| <img src="com.github.repostats.ulanziPlugin/assets/icons/action-release.svg" alt="GitHub RepoStats Deck Plugin" width="8%"> **Latest Release** | Newest release | version → downloads → published |
| <img src="com.github.repostats.ulanziPlugin/assets/icons/action-commits.svg" alt="GitHub RepoStats Deck Plugin" width="8%"> **Commit Activity** | Last 7 days | commits → last author → last time |
| <img src="com.github.repostats.ulanziPlugin/assets/icons/action-ci.svg" alt="GitHub RepoStats Deck Plugin" width="8%"> **CI / Actions** | Latest workflow run | status (✓/✗/running) → last run |
| <img src="com.github.repostats.ulanziPlugin/assets/icons/action-issues.svg" alt="GitHub RepoStats Deck Plugin" width="8%"> **Issues & PRs** | Open counts | issues → pull requests |
| <img src="com.github.repostats.ulanziPlugin/assets/icons/action-user.svg" alt="GitHub RepoStats Deck Plugin" width="8%"> **User / Org** | Any profile | followers → repos → gists → following |
| <img src="com.github.repostats.ulanziPlugin/assets/icons/action-rate.svg" alt="GitHub RepoStats Deck Plugin" width="8%"> **API Rate Limit** | Your API quota | remaining → reset countdown |

---

## 🎨 Features

- **Press-to-cycle** carousel — one clear metric per key, with a matching icon and a dot indicator.
- **Marquee** — long repo/user names scroll automatically.
- **Auto-refresh** on a configurable interval (no key press needed).
- **8 color themes** (GitHub, Midnight, Carbon, Ocean, Grape, Mono, Paper, Snow), **4 vector fonts**, optional animated accent.
- **Optional token** — for private repos and a higher rate limit (5,000/h vs ~60/h).
- **Built-in tutorial** — a **?** button on every action opens a step-by-step guide for that function, localized.
- **11 languages** — English, Português (BR/PT), Español, Français, Deutsch, Italiano, 日本語, 한국어, 中文 (简/繁).
- **Cross-platform & light** — pure-JS (no native binaries); glyph caching + image dedup keep the deck idle when nothing changes.

---

## 🔑 GitHub token (optional)

Without a token, public data works fine but GitHub limits requests to ~60/hour.
Add a **fine-grained Personal Access Token** (read-only) in the action settings to:

- raise the limit to **5,000/hour**, and
- monitor **private** repositories.

The token is stored only in the action settings and is sent only to `api.github.com` over HTTPS — never logged or shared.

---

## 📦 Installation

**From the Ulanzi store:** search for **GitHub Repo Stats** and install.

**Manual:**
1. Download/clone this repository.
2. Copy the `com.github.repostats.ulanziPlugin` folder into your Ulanzi plugins directory:
   - **Windows:** `%AppData%\Ulanzi\UlanziDeck\Plugins\`
   - **macOS:** `~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/`
3. Restart UlanziDeck Studio.

---

## 🗂️ Repository structure

```
com.github.repostats.ulanziPlugin/
├── manifest.json            # 7 actions
├── plugin/app.js            # backend: fetch + render + cache
├── property-inspector/
│   ├── inspector.html/js    # settings panel (adapts per action)
│   └── tutorial.html        # per-function guide (11 langs)
├── assets/icons/            # action + brand icons
├── <lang>.json × 11         # localization
├── LICENSE · THIRD-PARTY-LICENSES.md
└── node_modules/ (opentype.js, ws)
```

---

## 🛠️ Tech

- **Data:** GitHub REST + Search API. **Translation/fonts:** vector glyphs via `opentype.js`.
- **No telemetry**, no accounts — every request is read-only to GitHub.
- Performance: the static key body is cached and identical frames are never re-pushed to the deck.

---

## 📄 License

MIT © Jean Almeida — see [`LICENSE`](com.github.repostats.ulanziPlugin/LICENSE).
Third-party notices in [`THIRD-PARTY-LICENSES.md`](com.github.repostats.ulanziPlugin/THIRD-PARTY-LICENSES.md).
