# bycarter.com — Philadelphia Real Estate CRM

The whole site is one file: `index.html` (no server and no passwords or keys in the code).

## Go live on GitHub Pages (free)
1. On github.com (account **codingbycarter**), click **+ → New repository**.
   - Name: `bycarter.com`
   - Visibility: **Public** (required for free Pages)
2. Click **uploading an existing file**, drag in `index.html` and `README.md`, and click **Commit changes**.
3. Go to **Settings → Pages**. Set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**, then click **Save**.
4. In 1–2 minutes the site is live at **https://codingbycarter.github.io/bycarter.com/**

### Use the bycarter.com domain (optional)
1. In **Settings → Pages → Custom domain**, enter `bycarter.com` and click **Save**.
2. At your domain provider, add these DNS records:
   - Four **A** records for `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`
   - One **CNAME** record for `www` pointing to `codingbycarter.github.io`
3. When the DNS check passes, tick **Enforce HTTPS**.

## Using it
- Log in as **Carter** with PIN `2424` (Admin's PIN is `1234`). Change both PINs right away in Settings.
- Data is saved only in the browser of the device you use. Nothing is stored on GitHub.
- Back up your data weekly with **Settings → Export backup**, and use **Restore backup** on a new device.
