# Deploying MindLeaf

The prototype runs on two services:

| What | Where | Why |
| --- | --- | --- |
| Backend (FastAPI), PostgreSQL 16, frontend (static site) | [Render](https://render.com), free plan, Frankfurt region | Pulls the code straight from GitHub, gives HTTPS URLs, rebuilds on every push to `main` |
| Sign-up and sign-in | [Amazon Cognito](https://aws.amazon.com/cognito/) user pool | Email + password with a confirmation code, plus Google; free for up to 50,000 monthly users |
| AI grading and quiz generation | GitHub Actions ([`ai-worker.yml`](../.github/workflows/ai-worker.yml)) + Claude Haiku 5.5 on [Amazon Bedrock](https://aws.amazon.com/bedrock/) | The worker runs every 5 minutes; it talks to the API, never to the database; fractions of a cent per quiz |

The whole Render setup is in [`render.yaml`](render.yaml). After deployment:

- site: `https://mindleaf-web.onrender.com`
- API: `https://mindleaf-api.onrender.com` (check: `/api/health` → `{"status":"ok"}`)

If a service name is already taken on Render, Render adds a suffix to the URL. In that case, use the real URLs in the variables from step 3 and in Cognito.

## First deployment

The order matters: Cognito needs the site's URL, and the site needs Cognito's IDs.

### Step 1. Render: database, backend and frontend

1. Sign in at render.com with **Sign in with GitHub**.
2. **New → Blueprint**, pick the `mindleaf` repository.
3. **Blueprint Path:** `infra/render.yaml` → **Apply**.
4. Render asks for the variables that have no value (`COGNITO_*`, `VITE_COGNITO_*`). For now, enter `todo` in each — the real values come in step 3.
5. Wait until all three resources are **Live** (the first build takes 5–10 minutes).

The site already opens, but sign-in does not work yet.

### Step 2. Cognito: user pool

In the [AWS console](https://console.aws.amazon.com/cognito/) (region in the top right — **Europe (Frankfurt) eu-central-1**):

1. **Create user pool**.
2. Application type — **Single-page application (SPA)**, name — `mindleaf-web`.
3. **Options for sign-in identifiers:** Email. **Self-registration:** enabled. **Required attributes:** email.
4. **Return URL:** `https://mindleaf-web.onrender.com/` → **Create user directory**.
5. Open the new pool → **App clients** → `mindleaf-web` → **Login pages** → **Edit**:
   - **Allowed callback URLs:** `https://mindleaf-web.onrender.com/` and `http://localhost:5173/`
   - **Allowed sign-out URLs:** the same two URLs
   - **OAuth grant types:** Authorization code grant
   - **OpenID Connect scopes:** `openid`, `email`, `profile`
   - **Save changes**
6. Note three values:
   - **User pool ID** (on the pool page, like `eu-central-1_AbCdEf123`);
   - **Client ID** (App clients → `mindleaf-web`);
   - **Domain** (Branding → Domain, like `https://eu-central-1abcdef.auth.eu-central-1.amazoncognito.com`).

### Step 3. Cognito IDs in Render

On render.com → **mindleaf-api → Environment**:

| Variable | Value |
| --- | --- |
| `COGNITO_AUTHORITY` | `https://cognito-idp.eu-central-1.amazonaws.com/<User pool ID>` |
| `COGNITO_CLIENT_ID` | `<Client ID>` |

**mindleaf-web → Environment**:

| Variable | Value |
| --- | --- |
| `VITE_COGNITO_AUTHORITY` | same as `COGNITO_AUTHORITY` |
| `VITE_COGNITO_CLIENT_ID` | `<Client ID>` |
| `VITE_COGNITO_DOMAIN` | `<Domain>` (with `https://`, no trailing `/`) |

Save: **Save, rebuild, and deploy**. These values are public identifiers, not secrets: they end up in the frontend's JS bundle anyway.

### Step 4. Check

1. `https://mindleaf-api.onrender.com/api/health` → `{"status":"ok"}`.
2. `https://mindleaf-web.onrender.com` → **Увійти через email** (sign in with email) → **Sign up** → code from the email → your name → **Створити кабінет репетитора** (create a tutor cabinet).
3. In the tutor cabinet, add a student and issue a code on the student's card. In another browser (or a private window), sign up again and enter that code — the student's or the parent's cabinet opens.

## Sign in with Google

1. **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)) → new project `MindLeaf` → **Google Auth Platform** (OAuth consent screen) → **Get started**: app name `MindLeaf`, your email, audience **External** → create.
2. **Clients → Create client**: type **Web application**.
   - **Authorized JavaScript origins:** the Cognito domain, e.g. `https://eu-central-1xxxx.auth.eu-central-1.amazoncognito.com`
   - **Authorized redirect URIs:** the same domain + `/oauth2/idpresponse`

   Copy the **Client ID** and **Client secret**.
3. **Branding:** home page `https://mindleaf-web.onrender.com`, privacy policy `https://mindleaf-web.onrender.com/privacy`, authorized domains — the Cognito domain and `mindleaf-web.onrender.com` → **Save**. Then **Audience → Publish app**, so that anyone can sign in, not only test users. We only request email and name, so Google verification is not required.
4. **AWS Cognito → User pool → Authentication → Social and external providers → Add identity provider → Google**: Client ID, Client secret, **Authorized scopes** `profile email openid`; **Attribute mapping:** `email` ← `email`, `name` ← `name` → save.
5. **App clients → mindleaf-web → Login pages → Edit → Identity providers:** add **Google** (next to Cognito user pool) → **Save changes**.
6. **Render → mindleaf-web → Environment:** `VITE_GOOGLE_LOGIN` = `true` → **Save, rebuild, and deploy**. The sign-in page then shows **Увійти через Google** (sign in with Google).

An account created with Google and one created with email for the same address are two separate MindLeaf accounts.

## Telegram reminders

The bot writes to everyone who pressed **Підключити Telegram** (connect Telegram) in MindLeaf: about an hour before a lesson (with the Zoom/Meet link) and a day before a homework or quiz deadline. The backend remembers what it has already sent (the `reminders_sent` table), so calling it again never sends duplicates.

1. **Bot.** In Telegram, open [@BotFather](https://t.me/BotFather) → `/newbot` → name `MindLeaf` → a username ending in `bot` (e.g. `mindleaf_tutor_bot`). BotFather gives you a **token** like `123456789:AA…` — it is a secret.
2. **Render → mindleaf-api → Environment:**

   | Variable | Value |
   | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | the token from BotFather |
   | `TELEGRAM_BOT_USERNAME` | the bot's username without `@` |
   | `TELEGRAM_WEBHOOK_SECRET` | any long random string (the Blueprint generates it) |
   | `CRON_TOKEN` | any long random string (the Blueprint generates it) |

   **Save, rebuild, and deploy.**
3. **Connect the bot to the server** (once, after deployment) so that Telegram knows where to deliver the bot's messages:

   ```sh
   curl -X POST -H "X-Cron-Token: <CRON_TOKEN>" https://mindleaf-api.onrender.com/api/internal/telegram/webhook
   ```

   A response with `{"ok":true,…}` means it worked.
4. **Scheduler.** Something has to call `POST /api/internal/reminders/run` with the `X-Cron-Token` header every few minutes:
   - **[cron-job.org](https://cron-job.org)** (recommended, free and on time): a job with the URL `https://mindleaf-api.onrender.com/api/internal/reminders/run`, every 5 minutes, method `POST`, header `X-Cron-Token: <CRON_TOKEN>`, timeout 30 s. It also keeps the free Render backend from falling asleep.
   - **GitHub Actions** as a backup: [`.github/workflows/reminders.yml`](../.github/workflows/reminders.yml) runs every 10 minutes (GitHub may delay scheduled runs). It needs two repository secrets (**Settings → Secrets and variables → Actions**): `API_URL` = `https://mindleaf-api.onrender.com` and `CRON_TOKEN` = the same value as on Render. Check with **Actions → reminders → Run workflow**.

Without `TELEGRAM_BOT_TOKEN`, the connect button simply does not appear in the UI, and `/api/internal/*` answers 404.

## AI grading and quiz generation

Written quiz answers are graded, and materials are turned into draft quizzes, by a worker that runs in GitHub Actions every 5 minutes ([`.github/workflows/ai-worker.yml`](../.github/workflows/ai-worker.yml)). It calls Claude Haiku 5.5 on Amazon Bedrock and talks to the API only through `/api/internal/grading` and `/api/internal/generation` with a shared token. Anything it cannot grade goes to the tutor and is never retried. Both features are part of the Pro plan (a promo code is enough to try them).

1. **AWS → Amazon Bedrock** (region **us-east-1**) → **Model catalog** → **Claude Haiku 5.5**. If AWS asks for Anthropic's use-case form on first use, fill it in.
2. **AWS → IAM → Users → Create user** `mindleaf-ai-worker` (no console access) → **Add permissions → Create inline policy → JSON**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["bedrock-mantle:CreateInference", "bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
       "Resource": "*"
     }]
   }
   ```
   Then **Security credentials → Create access key → Application running outside AWS**. Copy the two values straight into GitHub (step 4); do not save them anywhere else.
3. **Render → mindleaf-api → Environment:** `GRADER_TOKEN` = a long random string (e.g. the output of `openssl rand -hex 32`), `AI_GRADER` = `on` → **Save changes**.
4. **GitHub → Settings → Secrets and variables → Actions → New repository secret:** `GRADER_TOKEN` (the same value as on Render), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `API_URL` = `https://mindleaf-api.onrender.com` if it is not there yet.
5. **Check:** **Actions → ai-worker → Run workflow**. The log ends with a line like `{'graded': 0, 'failed': 0, 'generated': 0, ...} in 1.2s with bedrock`. Then, as a tutor with Pro, open **Матеріали** (materials) → **Згенерувати тест** (generate a quiz): the draft appears after the next run.
6. **Costs:** **AWS → Billing → Budgets → Create budget** of $1 with an e-mail alert. Grading one quiz costs a fraction of a cent.

GitHub may delay scheduled runs by several minutes; **Run workflow** starts one at once. To switch AI off, set `AI_GRADER` = `off` on Render: written answers then go straight to the tutor.

## Promo codes and payment mode

| Variable | Where | Description |
| --- | --- | --- |
| `PROMO_CODES` | Render → mindleaf-api → Environment | Format: `CODE:DAYS:MAX_USES`, comma-separated. Example: `LAUNCH:30:50,BETA:14:10`. Empty — no promo codes. Case-insensitive. |
| `BILLING_MODE` | Render → mindleaf-api → Environment | `disabled` turns off the **Оформити Pro** (get Pro) button — useful until LiqPay is connected. Promo codes keep working. The Blueprint sets `disabled` by default. |

To add `PROMO_CODES` on Render: **mindleaf-api → Environment → Edit** → find `PROMO_CODES` → enter the value → **Save changes**.

## Updates

Every `git push` to `main` rebuilds both services. The backend applies new Alembic migrations on start.

## Free plan limitations

- **Sleeping.** The backend sleeps after 15 minutes without requests; the first request after that waits up to a minute. The reminder scheduler keeps it awake; before a demo, open `/api/health` anyway.
- **Database.** Render's free PostgreSQL lasts 30 days; after that it has to be recreated or moved to a paid plan.
- **Homework photos** are stored on the container's disk and disappear after a restart. For permanent storage — S3 (`STORAGE_BACKEND=s3`, see `PROJECT.md`) or a paid Render disk.
- **AI** results arrive within about 5–15 minutes, not instantly: the worker runs on GitHub's schedule.
- **Paying for a plan** without LiqPay keys runs in demo mode, no money is charged. Real keys: `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`, `LIQPAY_SANDBOX` in the `mindleaf-api` variables.

The target production setup (Lambda, Aurora Serverless, S3, CloudFront, Terraform) is described in [`PROJECT.md`](../PROJECT.md#infra); this Render deployment is its simpler stand-in for the prototype.
