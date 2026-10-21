# Manual testing

A hands-on walkthrough of the whole product, using the [reference host](../apps/reference-host/README.md) and the builder. The automated suite (`vp run ready`) already proves each rule. This guide is for seeing it work, and for poking at what tests can't judge, such as wording and layout.

## Start

From the repository root, with Docker running:

```bash
vp install              # once
vp run demo             # wipes and re-seeds the data, then serves both apps
```

| App            | URL                   |
| -------------- | --------------------- |
| Reference host | http://localhost:4173 |
| Builder        | http://localhost:4174 |

Ctrl+C stops both. `vp run demo:keep` restarts without wiping your data. To get back to a clean demo while the servers are stopped, run `vp run demo` again. See the [reference host README](../apps/reference-host/README.md) for the routes, the dev users and why it runs under `vp preview`.

## Who you can be

Sign in at http://localhost:4173/login. The builder and the host share the cookie, so signing in once covers both.

| User           | Use it to                                                                     |
| -------------- | ----------------------------------------------------------------------------- |
| `acme-admin`   | Author, publish, delete and manage references; read and delete responses.     |
| `acme-analyst` | Read forms, responses and analytics. Nothing else.                            |
| `globex-admin` | Check that another tenant sees none of acme's data.                           |
| `alice`, `bob` | Respond as an identified person.                                              |
| anonymous      | Respond with a form-bound grant. Can't edit, and can't answer a limited form. |

## 1. Sign in to the builder

1. Open the builder. It shows a "Sign in" link.
2. Follow it, pick `acme-admin`, and come back. The list shows acme's forms, including "Onboarding survey".
3. Switch to `acme-analyst` and reload. There should be no "Create form", no Publish and no delete buttons, but responses and analytics are readable.
4. Switch to `globex-admin`. None of acme's forms should appear.

## 2. Author and publish

As `acme-admin`:

1. Create a form. Add one question of each of the seven types: text, email, number, date, single choice, multiple choice and yes/no.
2. Reorder questions with the move up and down buttons, using only the keyboard. Focus should follow the moved question.
3. Save, then Preview. Preview should render the form without creating anything. In the browser's Network tab there should be no `/respond` request.
4. Publish with something incomplete, such as a choice question with a blank option. Every problem should be listed at once.
5. Fix them and publish. Edit the form, publish again, and the history should list both versions and mark the current one.
6. Try Save from two tabs on the same draft. The second save should offer to reload or keep your changes.
7. Create a second form, never publish it, and delete it. It disappears from the list. A published form has no delete button, only "Discard draft".
8. Change a form's availability and response limit in its settings.

## 3. Respond

On the reference host, as different users:

1. Open http://localhost:4173/projects/acme-spring-orders. The renderer shows the project's form. Fill it in and submit.
2. Sign in as `alice`, open the page and submit. Reload the page: you should be taken straight to editing your response. Edit it and save.
3. Keep the page open, then publish a new version of that form in the builder. Submitting from the open page should ask you to reload.
4. As anonymous, load the page. On an unlimited form you can submit. Set the form's response limit to one per respondent in the builder and reload: you should be asked to sign in.
5. Set the form's availability to closed. The page should say the form is closed.
6. Open http://localhost:4173/projects/acme-nothing. You should see "No open form for this project".
7. Open http://localhost:4173/projects/globex-partner-summit while signed in as `alice`. The project belongs to another tenant, so the form shouldn't load: `/token?project=globex-partner-summit` answers 403 (check the Network tab).
8. Submit with the network offline (browser dev tools, "Offline", just before you click Submit). The answers should lock with "We couldn't confirm your response was received" and a Retry button. Go back online and click Retry. Then open the project in `/admin` as `acme-admin`: it should list exactly one new response, not two.
9. Use only the keyboard to fill in and submit all seven types. Errors should move focus to the first invalid field.

## 4. Responses, erasure and references

1. In the builder, open a form's Responses. Each response should show its questions and answers as they were in the version it was submitted under, even after later versions changed the questions. Try the filters and the paging.
2. Delete one response as `acme-admin`. As `acme-analyst` there should be no delete.
3. Open http://localhost:4173/admin as `acme-admin`. Remove the project's reference from its form: `/projects/acme-spring-orders` should now say "No open form". Add it back, and the form returns. The page also lists the responses submitted under the project.
4. Attach the same reference to a second open published form. The project page should now show the "ambiguous" page, listing both titles.

## 5. Analytics

1. Open "Onboarding survey" and its Analytics. Each question has an "All versions" table and a "By version" table.
2. Check the cross-version cases the seed set up: a dropped question reads "Not in this version" for the versions that lack it, an added option has counts only from the versions that offered it, a relabelled option is reported with the labels it had, a widened number range is reported per version, and the reidentified question appears as two separate questions.
3. Submit another response to the form and reload the analytics: the counts update, because they're computed on read.

## Try the API directly

The API is at http://localhost:4173/api. Get a token from the host:

```bash
# No token
curl -i http://localhost:4173/api/forms                          # 401 with reason "missing"

# A tenant-wide token for a dev user
TOKEN=$(curl -s -b 'dev-user=acme-admin' http://localhost:4173/token | jq -r .token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4173/api/forms | jq

# A token bound to the project's form, as the anonymous user (no cookie)
GRANT=$(curl -s 'http://localhost:4173/token?project=acme-spring-orders' | jq -r .token)
curl -s -H "Authorization: Bearer $GRANT" http://localhost:4173/api/forms   # 403: a grant is not an admin
```

Things worth trying:

- A form id that belongs to another tenant gives 404, never 403.
- A body larger than 1 MiB on a draft save, or 16 KiB elsewhere, gives 413 with the limit.
- `curl -H 'Transfer-Encoding: chunked' -d @file` gives 411, because the module needs a `Content-Length`.
- Submitting the same `idempotencyKey` twice returns the same `responseId` both times.
- `GET /api/respond/forms/{formId}/versions/{versionId}/answer-schema` returns a JSON Schema for the version's answers.

The full endpoint and error list is in the [HTTP API surface ticket](../.scratch/form-builder-mvp/issues/16-http-api-surface.md). The OpenAPI document is [`packages/http-api/openapi.json`](../packages/http-api/openapi.json).

## When something looks wrong

| Symptom                                   | Likely cause                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The builder form list is empty or errors  | The host isn't on port 4173, or Postgres isn't running (`vp run postgres`).                                                                                      |
| "Sign in" appears again after signing in  | The cookie belongs to `localhost`. Use `localhost`, not `127.0.0.1`, in both apps.                                                                               |
| `vp run demo` fails to start              | Another process holds port 4173 or 4174. The ports are fixed. A server left over from an earlier run can be stopped with `lsof -ti tcp:4173,4174 \| xargs kill`. |
| The renderer doesn't appear on a project  | Check the browser console for a CSP violation, and that the project has exactly one open published form.                                                         |
| Data from a previous session confuses you | Stop the demo and run `vp run demo` for a clean start.                                                                                                           |
| A code change doesn't show                | Preview doesn't watch. Stop the demo and start it again.                                                                                                         |

## What the automated suite already covers

You don't need to re-test these by hand:

- `vp test` and `vp run test:pg`: every use-case rule, every database trigger, and races between connections.
- `vp run e2e`: the flows that cross components, in Chromium, Firefox and WebKit, including the strict CSP, axe accessibility checks and a keyboard-only run.
- `vp run ready`: everything CI runs.
