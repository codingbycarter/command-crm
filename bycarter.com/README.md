# bycarter.com

| Page | Path |
|---|---|
| Landing page | `index.html` |
| Philadelphia real estate CRM | `crm/` |
| Rich Girl Problemz Digital Solutions | `rgp/` |
| Credit Repair | `credit/` |

All pages are static HTML. There's no server, and the code holds no passwords or keys.

## Go live on GitHub Pages (free)
1. In this repo, go to **Settings → Pages**.
2. Set Source to **Deploy from a branch**.
3. Pick the branch, choose the folder, and click **Save**.

The site is public on the internet.

To use the bycarter.com domain:
1. Go to **Settings → Pages → Custom domain** and enter `bycarter.com`.
2. At your domain provider, add four **A** records for `@`:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. Also add a **CNAME** record: `www` → `codingbycarter.github.io`.
4. Turn on **Enforce HTTPS**.

## CRM notes
- Log in as **Carter** (PIN `2424`) or **Admin** (PIN `1234`). Change both PINs in Settings.
- Data is saved only in the browser on each device.
- Use **Settings → Export backup** weekly.
