<script lang="ts">
  import type { FormApiClient, Schemas } from "@fb/api-client";
  import { outcome, settleWrite } from "#lib/api.ts";
  import { checkClass, fieldClass, nativeInputClass } from "#lib/editors/props.ts";

  type Settings = Pick<Schemas["Form"], "availability" | "responseLimit">;

  let {
    client,
    form,
    saved,
    reload,
    signIn,
  }: {
    client: FormApiClient;
    form: Schemas["FormDetail"];
    /** The API accepted a change: `settings` are the form's settings now. */
    saved: (settings: Settings) => void;
    /** Rereads the form's detail. */
    reload: () => Promise<void>;
    signIn: () => void;
  } = $props();
  const uid = $props.id();

  let busy = $state(false);
  let notice = $state<string | null>(null);

  /** Sends one setting. The control is left showing the form's setting as it then stands. */
  const change = async (settings: Schemas["FormSettings"]) => {
    busy = true;
    notice = null;
    const result = await outcome(() =>
      client.PATCH("/forms/{formId}", { params: { path: { formId: form.id } }, body: settings }),
    );
    busy = false;
    await settleWrite(result, {
      ok: ({ availability, responseLimit }) => {
        saved({ availability, responseLimit });
        notice = "Settings saved";
      },
      rejected: async (error) => {
        if (error._tag === "FormNotPublished") {
          notice = "This form has no published version, so it can't be opened.";
          await reload();
        } else if (error._tag === "NotFound") {
          await reload();
        } else {
          notice = "The settings couldn't be changed.";
        }
      },
      unknown: async () => {
        await reload();
        notice = "We couldn't confirm the settings were changed, so they have been reloaded.";
      },
      signIn,
      notice: (message) => (notice = message),
    });
  };
</script>

<section class="flex flex-col gap-3" aria-labelledby={`${uid}-heading`}>
  <h2 id={`${uid}-heading`} class="text-lg font-semibold">Settings</h2>
  <label class={checkClass}>
    <input
      type="checkbox"
      checked={form.availability === "open"}
      disabled={busy || (form.currentVersion === null && form.availability === "closed")}
      onchange={async (event) => {
        const input = event.currentTarget;
        await change({ availability: input.checked ? "open" : "closed" });
        input.checked = form.availability === "open";
      }}
    />
    Open for responses
  </label>
  {#if form.currentVersion === null}
    <p class="text-sm text-muted-foreground">Publish the form to open it.</p>
  {/if}
  <div class={fieldClass}>
    <label for={`${uid}-limit`}>Response limit</label>
    <select
      id={`${uid}-limit`}
      class={nativeInputClass}
      value={form.responseLimit}
      disabled={busy}
      onchange={async (event) => {
        const select = event.currentTarget;
        await change({
          responseLimit: select.value === "unlimited" ? "unlimited" : "one_per_respondent",
        });
        select.value = form.responseLimit;
      }}
    >
      <option value="unlimited">Unlimited</option>
      <option value="one_per_respondent">One per respondent</option>
    </select>
  </div>
  {#if notice !== null}
    <p role="status">{notice}</p>
  {/if}
</section>
