# Top Hat and Tails — Cloudflare Pages + Decap CMS

The project contains your logo and rehearsal photograph, a responsive black/white/gold website, and a browser-based Decap editor. It is prepared for your own Cloudflare and GitHub accounts. It has not been deployed or connected to your account yet.

## First: put the website on Cloudflare

1. Create a **private** GitHub repository named `top-hat-and-tails`, with a `main` branch. Upload this project's contents at the repository root (the folder containing `package.json`). Do not upload the ZIP itself. Keep the repository private: it stores member notices as well as public website content.
2. In Cloudflare, choose **Workers & Pages → Create application → Pages → Connect to Git**. Connect GitHub and select that repository.
3. Use these build settings:

| Setting | Value |
|---|---|
| Framework preset | None |
| Production branch | `main` |
| Build command | `node scripts/build.mjs` |
| Build output directory | `dist` |
| Root directory | Leave blank |
| Environment variable `NODE_VERSION` | `22` |

4. Deploy. Cloudflare will give you the actual `https://….pages.dev` address. Your public pages will work immediately. The editor, member login and application submission deliberately remain unavailable until their configuration below is complete.

Use Git integration rather than a one-off drag-and-drop deployment: saving content in Decap creates a Git commit, which Cloudflare then builds and publishes automatically.

## Connect the editor

In Cloudflare Pages project settings, add **production runtime variables/secrets**:

| Name | Value | Secret? |
|---|---|---|
| `PUBLIC_SITE_URL` | Your exact primary HTTPS website origin, with no trailing slash | No |
| `GITHUB_REPO` | `your-github-username/top-hat-and-tails` | No |
| `GITHUB_CLIENT_ID` | GitHub OAuth application's client ID | No |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth application's client secret | Yes |

Create the OAuth application in GitHub **Settings → Developer settings → OAuth Apps → New OAuth App**:

- Application name: `Top Hat and Tails editor`
- Homepage URL: your website origin
- Authorization callback URL: your website origin followed by `/api/callback`

Keep the client secret in Cloudflare, never in GitHub source files or Decap content. Redeploy after changing settings, then open your website's `/admin/` address and sign in through GitHub.

The included same-origin OAuth handler verifies the browser state, checks that the configured repository is private and that the editor has write access, and returns the token only to the exact website origin. The standard Decap GitHub OAuth integration requests GitHub's `repo` scope; that scope is broader than one repository. Editors should understand this when authorising the OAuth app. Only trusted company editors should have repository write access. Public visitors and ordinary theatre members do not need GitHub accounts.

Decap provides five editing sections:

- Homepage & company: name, introduction, logo, hero photo, about text and privacy notice.
- News: add an article, date, summary and optional image.
- Team profiles: add a name, role, biography, portrait and display order.
- Production galleries: add a title, year, introduction and photographs with descriptions/captions.
- Members notices: update the private rehearsal information and notices.

News, profiles and productions have a **Visible on website** switch. It defaults to off. Turn it on when ready, save, and wait for Cloudflare's next deployment to finish. Text fields use plain paragraphs; separate paragraphs with a blank line. Gallery photographs enlarge when clicked and close with Escape or the close button.

No team names, production histories, rehearsal dates or news announcements were invented. Add your real content in Decap. The supplied logo screenshot is cropped at its right edge; replace it with the complete original when available.

## Enable members access

The site uses the shared company password approach discussed earlier, not individual member accounts.

1. In Cloudflare **Turnstile**, create a managed widget and allow your production site's hostname.
2. Add these production runtime values in the Pages project:

| Name | Value | Secret? |
|---|---|---|
| `TURNSTILE_SITE_KEY` | Widget site key | No |
| `TURNSTILE_SECRET_KEY` | Widget secret key | Yes |
| `MEMBERS_PASSWORD` | A strong company passphrase of at least 16 characters | Yes |
| `SESSION_SECRET` | A random secret of at least 32 characters, generated with your password manager | Yes |

3. Redeploy, open `/members/`, complete the security check and sign in.

Member content is rendered by the server only after session verification. It is never copied into public HTML or JSON. Signed cookies are Secure, HttpOnly, SameSite=Lax and expire after eight hours. Changing the company password invalidates existing sessions. Logout clears the browser cookie.

Members editing supports text notices, not confidential file uploads. All `/uploads/` images are public. Do not attach private documents through the CMS media picker. A future private download feature would need separate protected storage.

Set the primary origin consistently. Member/API/editor routes are intentionally unavailable at alternate deployment-preview addresses. If adding a custom domain later, update `PUBLIC_SITE_URL`, the GitHub OAuth URLs and Turnstile's allowed hostname, then redeploy.

## Open the application form

The form saves applications to your Cloudflare D1 database. It does not send emails or expose application records through the public website.

1. In Cloudflare's D1 section, create a database called `top-hat-and-tails-applications`.
2. Run the SQL in `schema.sql` in its console.
3. In your Pages project settings, add a **D1 database binding** called exactly `DB`, linked to that database.
4. Ensure the Turnstile keys above are configured.
5. In Decap → Homepage & company, write the application privacy notice. Include who receives applications, how the information is used, how long it is retained, and the company contact for enquiries. Applications stay closed while this field is empty.
6. Redeploy and submit a test application. Check that a row appears in the D1 `applications` table before inviting real applications.

Application fields: name, email, optional phone, interests, optional experience, privacy acknowledgement. Requests are validated server-side and protected by Turnstile, origin checks, request-size limits and parameterised SQL. A success message is returned only after database persistence succeeds. The privacy notice in force at submission is stored alongside each application.

Read and manage responses in the Cloudflare D1 dashboard. Access to that dashboard should be limited to authorised company administrators. There is no automatic deletion schedule; delete applications in accordance with the retention period you publish. Email notifications or a separate staff application dashboard can be added later if wanted.

## Local commands and source layout

No npm packages are required for the site generator. It uses Node's built-in modules. Decap's browser bundle loads from its documented jsDelivr CDN on the editor route only. It requires an internet connection.

```sh
node scripts/build.mjs
node --test tests/site.test.mjs
```

- `content/`: public content edited by Decap.
- `private/members.json`: protected notice content; private repository required.
- `public/`: public styles, browser script and uploaded images.
- `src/render.mjs`: shared escaped HTML rendering.
- `src/worker.mjs`: authentication, editor configuration, member rendering and application submission.
- `scripts/build.mjs`: generates public pages plus the Cloudflare advanced-mode `_worker.js` bundle.
- `schema.sql`: application database table.
- `.dev.vars.example`: names of runtime settings; no real credentials included.
- `wrangler.toml.example`: optional Wrangler configuration, not required for dashboard deployment.

**Deploy only the generated `dist` directory to Cloudflare Pages.** Do not serve the repository root with a plain web server: it contains private source content. Cloudflare recognises `_worker.js` as executable server code rather than a downloadable asset. The routing manifest sends member, API and editor paths through it; public page and image requests are served as static assets.

For local full-stack work, use Cloudflare Wrangler's Pages development mode with `dist`, configure local secrets separately and use appropriate test Turnstile configuration. The included primary-origin and HTTPS checks are intended for production; the Node tests use controlled HTTPS request fixtures.

## Validation and remaining setup

The build and seven Node tests pass, covering unauthorised member access, source-path protection, origin validation, session validation and password rotation, logout, application validation/persistence failure, OAuth state/repository checks, CMS configuration and public-output separation. Upstream GitHub/Turnstile calls and D1 writes are simulated in these tests. Actual OAuth login, Cloudflare deployment, email-independent application storage and the final layout must be verified in your account. No browser QA has been performed.

All production services remain closed when their required configuration is missing. This is a deployable source project, not an already-live website.

## References

- [Cloudflare Pages Git deployment](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare advanced-mode Worker](https://developers.cloudflare.com/pages/functions/advanced-mode/)
- [Cloudflare bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/)
- [Decap GitHub backend](https://decapcms.org/docs/github-backend/)
- [Decap installation](https://decapcms.org/docs/install-decap-cms/)

Project code is supplied under the MIT licence in `LICENSE`. The supplied company images remain their owners' property. Decap is separately MIT-licensed. Cloudflare and GitHub service terms and free-tier quotas apply; this project does not purchase plans or enable paid upgrades.
