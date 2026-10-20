# MVP product calls on the ADR open questions

Type: grilling
Status: open
Map: [Form builder MVP](../map.md)

## Question

For each open question in ADR 0001 §13 that is still in scope, what is the minimal MVP answer that meets the §12 bar, or is it deferred? In particular:

- One active draft per form, or several concurrent drafts?
- Can respondents resume incomplete responses (autosave), and what happens to abandoned ones?
- Can respondents edit or resubmit after submission? Who configures duplicate-submission rules, and how?
- Can historical versions be reopened for new submissions?
- Which question types ship in the MVP (is file upload in or out), and is any conditional visibility in?
- The submission consistency policy (ADR §5): when a new version is published mid-session, accept under the presented version or require a reload?
- Do analytics combine compatible versions by default or only on request?
- Where do external references live: on forms, on responses, or in a separate association model?
- What retention and deletion behaviour does the MVP need, if any?
- Are analytics built inside the module, or exposed as data for hosts to consume?
