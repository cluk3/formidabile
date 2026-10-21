<script lang="ts">
  import QuestionCard from "./QuestionCard.svelte";

  let { title = "Placeholder form" }: { title?: string } = $props();
</script>

<section class="root" part="root">
  <h2 class="title">{title}</h2>
  <QuestionCard label="Placeholder question" value="Nested component" />
  <button class="submit" part="submit" type="button">Submit</button>
</section>

<style>
  .root {
    display: block;
    padding: 1rem;
    background-color: rgb(250, 250, 240);
    font-family: inherit;
  }
  .title {
    margin: 0 0 0.5rem;
    color: rgb(10, 20, 30);
  }
  .submit {
    margin-top: 0.5rem;
  }
</style>
