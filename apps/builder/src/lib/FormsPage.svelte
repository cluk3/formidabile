<script lang="ts">
  import type { FormApiClient, Schemas } from "@fb/api-client";
  import { onMount } from "svelte";
  import { outcome } from "#lib/api.ts";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Label } from "#lib/components/ui/label/index.js";

  let { client, signInHref }: { client: FormApiClient; signInHref: string } = $props();

  let forms = $state<ReadonlyArray<Schemas["FormSummary"]> | null>(null);
  let signedOut = $state(false);
  let loadFailed = $state(false);
  let notice = $state<string | null>(null);
  let title = $state("");
  let creating = $state(false);

  const tokenUnavailable = "Couldn't get a sign-in token from the host. Try again.";

  const load = async () => {
    const result = await outcome(() => client.GET("/forms"));
    loadFailed = false;
    if (result.kind === "ok") forms = result.data.forms;
    else if (result.kind === "signIn") signedOut = true;
    else loadFailed = true;
  };

  const create = async (event: SubmitEvent) => {
    event.preventDefault();
    creating = true;
    notice = null;
    const result = await outcome(() =>
      client.POST("/forms", { body: { definition: { format: 1, title, questions: [] } } }),
    );
    if (result.kind === "ok") {
      title = "";
      await load();
    } else if (result.kind === "unknown") {
      notice = "We couldn't confirm the form was created, so the list has been reloaded.";
      await load();
    } else if (result.kind === "signIn") {
      signedOut = true;
    } else if (result.kind === "tokenUnavailable") {
      notice = tokenUnavailable;
    } else {
      const { error } = result;
      notice =
        error._tag === "ValidationFailed"
          ? `The form couldn't be created: ${error.issues.map((issue) => issue.message).join("; ")}`
          : "The form couldn't be created.";
    }
    creating = false;
  };

  onMount(load);
</script>

<section class="flex flex-col gap-6">
  {#if signedOut}
    <p>
      Sign in as an admin who can manage forms.
      <a class="font-medium underline" href={signInHref}>Sign in</a>
    </p>
  {:else}
    <form class="flex items-end gap-2" onsubmit={create}>
      <div class="flex grow flex-col gap-1.5">
        <Label for="new-form-title">Title</Label>
        <Input id="new-form-title" bind:value={title} maxlength={200} />
      </div>
      <Button type="submit" disabled={creating}>Create form</Button>
    </form>

    {#if notice !== null}
      <p role="status">{notice}</p>
    {/if}

    <h2 class="text-lg font-semibold">Forms</h2>
    {#if loadFailed}
      <p>
        Couldn't load the forms.
        <Button variant="outline" size="sm" onclick={load}>Retry</Button>
      </p>
    {:else if forms === null}
      <p class="text-muted-foreground">Loading…</p>
    {:else if forms.length === 0}
      <p class="text-muted-foreground">No forms yet</p>
    {:else}
      <ul class="divide-y rounded-md border">
        {#each forms as form (form.id)}
          <li class="flex items-center justify-between gap-4 p-3">
            <span class="font-medium">{form.title === "" ? "Untitled form" : form.title}</span>
            <span class="text-sm text-muted-foreground">
              {form.currentVersion === null ? "Draft" : `Published v${form.currentVersion.number}`}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>
