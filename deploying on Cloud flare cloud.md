**Component**	              **Status**

Local application testing	Passed

TypeScript checks	        Passed

Production build	         Passed

Cloudflare D1	               Created and migrated

Cloudflare R2	               Created

Worker deployment	       Pending

Production secrets	       Pending





1.Local setup and configuration

Completed

Node.js, npm, Git, dependencies, local secrets and D1 migrations.







2.Local application testing

Completed

Login, photo upload, collections, deletion and restoration.







3.Security and build review

In progress

Investigate why .dev.vars appears in the production build.







4\.

Connect your Cloudflare account

Next

Sign in through Wrangler and authorize your own Cloudflare account.**(npx wrangler whoami)**

**First, open a new browser tab:**

Open Cloudflare DashboardSign in or create your account if you don't already have one.





5.Create your Cloudflare resources

Pending

Your own R2 bucket, D1 database and Images configuration.



Next: Clean up the production build output

Before deploying, let's inspect why the local secrets file is copied into dist/shared\_gallery.(grep -n "dev.vars" .gitignore)



Next step: Investigate the Cloudflare Vite plugin

Let's inspect the installed plugin before changing anything.

(ls node\_modules/@cloudflare/vite-plugin)



Good. The Cloudflare Vite plugin is installed correctly. We can now inspect its configuration and build behavior.





We can now inspect its configuration and build behavior.(cat node\_modules/@cloudflare/vite-plugin/package.json)



so i created:

1\. D1 database: shared-gallery-db under my account.



Create your own D1 database **(npx wrangler d1 create shared-gallery-db)**



Next step: Verify the D1 configuration (npx wrangler d1 info shared-gallery-db)



Next step: Create your R2 bucket

R2 will store the original uploaded photos. It is separate from D1, which stores their metadata.

**(npx wrangler r2 bucket create shared-gallery-media)**



2\. R2 bucket: shared-gallery-media under my account. c

activate it and use (npx wrangler r2 bucket create shared-gallery-media)

R2 bucket was created successfully, but it added an unnecessary second binding.

Correct the R2 configuration



code wrangler.jsonc

&#x20;       |

&#x20;       V



"r2\_buckets": \[

&#x20; {

&#x20;   "binding": "BUCKET",

&#x20;   "bucket\_name": "shared-gallery-media"

&#x20; }

],


Next step: Apply migrations to your remote D1 database

I  have three migration files:

1\. 0001\_init.sql

2\. 0002\_exif\_metadata.sql

3\. 0003\_soft\_delete.sql



These created the gallery tables in your local database. Now we need to create the same schema in your Cloudflare database. 

(npx wrangler d1 migrations apply shared-gallery-db --remote)





🚣 Executed 4 commands in 0.54ms

┌────────────────────────┬────────┐

│ name                   │ status │

├────────────────────────┼────────┤

│ 0001\_init.sql          │ ✅     │

├────────────────────────┼────────┤

│ 0002\_exif\_metadata.sql │ ✅     │

├────────────────────────┼────────┤

│ 0003\_soft\_delete.sql   │ ✅     │



└────────────────────────┴────────┘

Next step: Verify remote database tables

Run this command:

(npx wrangler d1 execute shared-gallery-db --remote --command "SELECT name FROM sqlite\_master WHERE type='table' ORDER BY name;")



3\. Configure your Worker to use those resources.





**Before** deployment, we need to configure two secrets:

\- JWT\_SECRET: securely signs gallery login sessions.

\- GALLERY\_PASSWORD\_HASH: verifies the shared gallery password without storing the plaintext password.



6.Deploy the application

Pending

Configure production secrets, apply remote migrations and deploy your Worker.



**Verify the production deployment configuration**

Before deploying the application publicly, let's perform a dry run to check the Worker configuration.



In  Ubuntu terminal, run:



**npx wrangler deploy --dry-run**



**Wrangler prepares and validates the deployment locally, but does not publish your gallery to the internet.**



**npx wrangler deploy** 



**Unlike the dry run, this command will publish your application to Cloudflare and make it accessible through a public workers.dev URL.**

7.Production testing

Pending

Test login, upload, image delivery and restoration on your live URL.





8: Test delete and restore

Let's verify the soft-delete functionality.

1\. Return to your gallery.

2\. Select the sample image.

3\. Delete it.

4\. Open Recently Deleted from the settings menu.

5\. Confirm that the deleted image appears.

6\. Restore the image.

