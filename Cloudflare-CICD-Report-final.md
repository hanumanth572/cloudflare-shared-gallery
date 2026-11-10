# CI/CD Pipeline Implementation Report
## Cloudflare Shared Gallery

## 1. Project Objective

I implemented an automated CI/CD pipeline for my Cloudflare Shared Gallery project using GitHub Actions.

The main objective was to automate the application validation and deployment process. Whenever I push code changes to the `main` branch, GitHub Actions first validates the application. If the CI workflow completes successfully for a push to `main`, a separate CD workflow deploys the tested commit to Cloudflare Workers.

This reduces manual deployment steps and helps ensure that code is checked and built before it reaches the production environment.

## 2. Technologies I Used

| Tool / Technology | Purpose |
|---|---|
| Git and GitHub | Source code management and version control |
| GitHub Actions | CI/CD workflow automation |
| Node.js 24 | JavaScript runtime used by the project and workflows |
| npm | Dependency installation and script execution |
| TypeScript | Application and Worker code validation |
| Vite | Application build tool |
| Cloudflare Workers | Hosting and running the application |
| Cloudflare D1 | Application database |
| Cloudflare R2 | Object storage for images/media |
| Wrangler | Cloudflare development, type generation and deployment CLI |
| GitHub Actions Secrets | Secure storage of Cloudflare deployment credentials |

## 3. CI/CD Pipeline Overview

I separated the pipeline into two workflows:

- **CI (Continuous Integration):** installs dependencies, generates Cloudflare types, runs TypeScript checks and builds the application.
- **CD (Continuous Deployment):** starts only after the CI workflow has completed successfully for a push to the repository's `main` branch. It checks out the exact commit tested by CI, validates and builds it again, and deploys it to Cloudflare Workers.

### Pipeline flow

```text
Developer makes code changes
          |
          v
   git push origin main
          |
          v
   GitHub repository
          |
          v
   CI workflow starts
          |
          +--> Checkout source code
          |
          +--> Set up Node.js 24
          |
          +--> npm ci
          |
          +--> Generate Cloudflare types
          |
          +--> TypeScript checks
          |
          +--> Build application
          |
          v
   Did CI succeed for a push to main?
          |
          v
   CD workflow starts
          |
          +--> Checkout the exact tested commit
          |
          +--> Install dependencies
          |
          +--> Generate Cloudflare types
          |
          +--> Run TypeScript checks
          |
          +--> Build application
          |
          +--> Deploy using Wrangler
          |
          v
   Cloudflare Workers
          |
          v
   Production application
```

## 4. Building Continuous Integration (CI)

### 4.1 Create the GitHub Actions workflow directory

From the project root directory, I created the workflow folder:

```bash
mkdir -p .github/workflows
```

GitHub automatically detects workflow YAML files stored inside `.github/workflows/`.

### 4.2 Create the CI workflow file

```bash
nano .github/workflows/ci.yml
```

I created the following workflow:

```yaml
name: Cloudflare Shared Gallery - CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

permissions:
  contents: read

jobs:
  build-and-check:
    name: Install, Validate and Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout source code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate Cloudflare types
        run: npm run cf-typegen

      - name: Run TypeScript checks
        run: npm run check

      - name: Build application
        run: npm run build
```

To save the file in Nano:

- Press `Ctrl + O`.
- Press `Enter`.
- Press `Ctrl + X`.

I verified the file using:

```bash
cat .github/workflows/ci.yml
```

### 4.3 Understand the CI workflow

| Workflow element | What it does |
|---|---|
| `name` | Gives the workflow a readable name in GitHub Actions |
| `on: push` | Starts CI when code is pushed to `main` |
| `on: pull_request` | Starts CI when a pull request targets `main` |
| `permissions: contents: read` | Gives the workflow read-only access to repository contents |
| `jobs` | Defines the work GitHub Actions must execute |
| `runs-on: ubuntu-latest` | Runs the job on a GitHub-hosted Ubuntu runner |
| `actions/checkout@v4` | Checks out the repository source code |
| `actions/setup-node@v4` | Installs/configures Node.js 24 and npm caching |
| `npm ci` | Installs the exact dependency versions recorded in `package-lock.json` |
| `npm run cf-typegen` | Generates Cloudflare Worker TypeScript definitions |
| `npm run check` | Runs the project's TypeScript validation script |
| `npm run build` | Builds the production application |

### 4.4 Generate Cloudflare types

I used:

```bash
npm run cf-typegen
```

This runs the project's `cf-typegen` script, which invokes Wrangler to generate TypeScript definitions for the Cloudflare Worker environment.

The project uses bindings such as:

- `DB` — Cloudflare D1 database.
- `BUCKET` — Cloudflare R2 bucket.
- `IMAGES` — Cloudflare Images binding.
- `ASSETS` — static assets binding.

These generated definitions help TypeScript understand the Worker environment and its configured bindings.

### 4.5 Run TypeScript validation

I used:

```bash
npm run check
```

This runs:

```bash
tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.worker.json
```

It checks both the application and Worker TypeScript configurations without emitting compiled JavaScript files.

### 4.6 Build the application

I used:

```bash
npm run build
```

The build completed successfully. The output reported:

| Build output | Size | Gzip size |
|---|---:|---:|
| Cloudflare Worker | 81.56 KB | 21.90 KB |
| Client JavaScript | 266.47 KB | 80.41 KB |
| CSS | 37.15 KB | 7.35 KB |

These are the sizes reported by the local production build at the time of implementation.

### 4.7 CI validation results

I also ran the build and validation commands locally before relying on GitHub Actions.

| CI stage | Result |
|---|---|
| Dependency installation (`npm ci`) | Passed |
| Cloudflare type generation | Passed |
| TypeScript validation | Passed |
| Production build | Passed |
| GitHub Actions CI run | Passed |

## 5. Protecting Application Secrets

The project uses a local `.dev.vars` file for development secrets.

I checked that Git ignores this file:

```bash
git check-ignore .dev.vars
```

The `.gitignore` configuration prevents `.dev.vars` from being included in normal Git commits.

For deployment, I created a Cloudflare API token and stored the required credentials in the GitHub repository's Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

These values are referenced by the CD workflow. The actual token and account ID are not written directly into the workflow file or committed to the repository.

**Security note:** I do not include secret values in source code, screenshots, commits or this report. The local `.dev.vars` file and GitHub Actions secrets serve different purposes: `.dev.vars` is used for local development, while GitHub Actions secrets provide credentials to the automated deployment workflow.

## 6. Building Continuous Deployment (CD)

After confirming that CI worked, I created a separate workflow to deploy the application automatically to Cloudflare Workers.

### 6.1 Create the CD workflow file

```bash
nano .github/workflows/deploy.yml
```

I added the following workflow:

```yaml
name: Cloudflare Shared Gallery - CD

on:
  workflow_run:
    workflows:
      - Cloudflare Shared Gallery - CI
    types:
      - completed
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: cloudflare-production-deployment
  cancel-in-progress: false

jobs:
  deploy:
    name: Build and Deploy to Cloudflare
    if: >-
      ${{
        github.event.workflow_run.conclusion == 'success' &&
        github.event.workflow_run.event == 'push' &&
        github.event.workflow_run.head_branch == 'main' &&
        github.event.workflow_run.head_repository.full_name == github.repository
      }}
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout tested commit
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate Cloudflare types
        run: npm run cf-typegen

      - name: Run TypeScript checks
        run: npm run check

      - name: Build application
        run: npm run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          wranglerVersion: "4.107.1"
          command: deploy
```

### 6.2 Understand how the CD workflow is triggered

The CD workflow uses the `workflow_run` event. This means it waits for the named CI workflow to finish.

The job condition checks that:

1. The CI workflow conclusion is `success`.
2. The CI workflow was triggered by a `push` event, not a pull request.
3. The tested branch is `main`.
4. The source repository is the same repository where this CD workflow runs.

This prevents a pull request validation run from directly deploying to production.

### 6.3 Why checkout the tested commit?

I used:

```yaml
- name: Checkout tested commit
  uses: actions/checkout@v4
  with:
    ref: ${{ github.event.workflow_run.head_sha }}
```

`head_sha` identifies the exact commit associated with the completed CI run.

This is important because CD should deploy the same source revision that passed CI, rather than simply checking out whichever commit happens to be at the branch head later.

### 6.4 Why run the checks and build again in CD?

The CD workflow repeats dependency installation, Cloudflare type generation, TypeScript validation and the production build before deployment.

This makes the deployment job independently verify that the checked-out commit can be prepared for deployment.

### 6.5 Deploy to Cloudflare Workers

The final step uses the Cloudflare Wrangler GitHub Action:

```yaml
- name: Deploy to Cloudflare Workers
  uses: cloudflare/wrangler-action@v4
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    wranglerVersion: "4.107.1"
    command: deploy
```

Explanation:

- `cloudflare/wrangler-action@v4` runs Wrangler through a GitHub Action.
- `apiToken` reads the Cloudflare API token from GitHub Actions secrets.
- `accountId` reads the Cloudflare account ID from GitHub Actions secrets.
- `wranglerVersion` pins the Wrangler version used by the deployment job.
- `command: deploy` runs the Wrangler deployment command using the project's Cloudflare configuration.

The project is deployed to its configured Cloudflare Worker and existing `workers.dev` address. I removed the unnecessary Zone policy from the token setup because this project deploys to `workers.dev` and does not configure a custom domain or zone route.

## 7. GitHub Repository and Commit History

I used my own GitHub repository for this project:

- Repository: `https://github.com/hanumanth572/cloudflare-shared-gallery`
- Production application: `https://shared-gallery.hanumanthrao572.workers.dev`

The CI workflow was committed and pushed first. After confirming CI worked, I committed and pushed the CD workflow.

| Commit | Description |
|---|---|
| `41e7fba` | Add GitHub Actions CI workflow |
| `d78bd12` | Add Cloudflare Workers CD workflow |

The deployment workflow was committed separately so that its changes could be reviewed independently.

## 8. Final GitHub Actions Results

After pushing commit `d78bd12`, I checked the repository's GitHub Actions page.

The following runs completed successfully:

| Workflow | Run | Result |
|---|---|---|
| Cloudflare Shared Gallery - CI | #1, commit `41e7fba` | Successful |
| Cloudflare Shared Gallery - CI | #2, commit `d78bd12` | Successful |
| Cloudflare Shared Gallery - CD | #1 | Successful |

The CD run completed successfully in approximately 31 seconds, according to the GitHub Actions run summary.

This confirms that the GitHub Actions deployment job completed successfully. I should also check the production website and its main functions after deployment as a separate application-level smoke test.

## 9. How the Completed Pipeline Works

For a normal code change pushed to `main`, the process is:

1. I make a code change locally.
2. I commit the change using Git.
3. I push the commit to GitHub.
4. GitHub Actions starts the CI workflow.
5. CI installs dependencies, generates Cloudflare types, runs TypeScript checks and builds the application.
6. After CI completes successfully for a push to `main`, GitHub starts the CD workflow.
7. CD checks out the exact commit that CI tested.
8. CD installs dependencies, generates types, runs checks and builds the application.
9. Wrangler deploys the application to Cloudflare Workers.
10. I verify the production application.

If CI fails, the CD job condition is not satisfied, so this workflow does not proceed with the production deployment.

## 10. Current Scope and Possible Improvements

The implemented pipeline provides automated validation and deployment. These are possible next improvements; they are not claimed as completed in this implementation:

- Add automated unit and integration tests if the project has suitable test coverage.
- Add a production GitHub Environment with required approval before deployment.
- Add deployment notifications and clearer failure alerts.
- Add a documented rollback procedure and test it safely.
- Add dependency and security scanning, then review and resolve findings.
- Add a post-deployment smoke test to check that the production application responds and its key features work.
- Consider pinning third-party GitHub Actions to verified commit SHAs for stronger supply-chain security.

## 11. Conclusion

I successfully implemented and tested a two-workflow CI/CD pipeline for my Cloudflare Shared Gallery project.

The CI workflow automates dependency installation, Cloudflare type generation, TypeScript validation and production builds. The CD workflow waits for successful CI on a push to `main`, checks out the tested commit and deploys the application to Cloudflare Workers using Wrangler and GitHub Actions secrets.

Both CI workflows and the CD workflow completed successfully in GitHub Actions. This project gave me practical experience with GitHub Actions, YAML workflow configuration, CI/CD triggers, build validation, secure deployment credentials, Git version control and Cloudflare Workers deployment.

**Project status: CI/CD implementation completed and initial automated deployment successful.**
