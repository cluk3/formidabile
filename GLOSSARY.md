# Form Management

A reusable, host-agnostic module for defining forms, publishing immutable versions of them, collecting responses against a specific version, and analysing those responses.

## Definitions

**Form**:
The stable identity of a form across all of its versions.
_Avoid_: Survey, questionnaire, template

**Form version**:
An immutable, self-contained snapshot of a form's definition, created at publication.
_Avoid_: Revision, release

**Form definition**:
The content a draft edits and a form version freezes: the form's title, description and ordered question snapshots.
_Avoid_: Form schema, template, form JSON

**Draft**:
An editable working copy of a form's definition that has not been published.
_Avoid_: Unpublished version, working version

**Current published version**:
The form version that new submissions use by default.
_Avoid_: Latest version, active version

**Superseded version**:
A form version that was once the current published version and has since been replaced by a newer one.
_Avoid_: Old version, stale version, archived version

**Question identity**:
The stable logical identity of a question across form versions, held only while the question keeps its meaning.
_Avoid_: Question ID, field key

**Question snapshot**:
The complete definition of a question as it exists within one form version.
_Avoid_: Question, field

**Option value**:
The stable machine-readable value of a choice option, distinct from its display label.
_Avoid_: Option key, option ID

**Question type**:
The kind of a question snapshot, which fixes its answer representation and validation. Presentation choices that leave the answer unchanged, such as a dropdown versus radio buttons or single-line versus multi-line text, are not question types.
_Avoid_: Field type, widget

**Availability**:
Whether a form currently accepts responses (open or closed), independent of its publication history.
_Avoid_: Status, active, enabled

**Builder**:
The administrative interface for creating forms, editing drafts and publishing form versions.
_Avoid_: Editor, designer, admin

**Renderer**:
The respondent-facing interface that displays one form version and collects or edits a response against it.
_Avoid_: Viewer, player, form widget

**Preview**:
Rendering a draft so an editor can try it, without ever creating a response.
_Avoid_: Test submission, dry run

## Collection

**Response**:
One submission against exactly one published form version.
_Avoid_: Submission, entry, result

**Answer**:
A respondent's answer to one question snapshot within a response.
_Avoid_: Value, field value

**Respondent**:
The actor who fills in and submits a response.
_Avoid_: User, participant

**Identified respondent**:
A respondent with a stable identity supplied by the host application.
_Avoid_: Logged-in user, known respondent

**Anonymous respondent**:
A respondent the host application admits to one form without identifying them. They can't edit their response or answer a form limited to one response per respondent.
_Avoid_: Guest, public user, unauthenticated respondent

**Response limit**:
A form's rule for how many responses one respondent may submit: unlimited, or one per respondent.
_Avoid_: Duplicate rule, submission quota

## Integration

**Host application**:
An application that embeds or calls the form module and owns its own domain, workflows, and authorization policies.
_Avoid_: Client app, consumer, parent app

**Tenant**:
An opaque isolation boundary, defined by the host application, that owns forms and their responses. Every actor belongs to exactly one tenant.
_Avoid_: Organization, workspace, scope

**External reference**:
A generic pointer, made of a namespace and an identifier, from a form or response to an entity owned by a host application. A response's external references are asserted by the host application, never by the respondent.
_Avoid_: Link, foreign key, association
