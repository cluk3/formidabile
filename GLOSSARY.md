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
The content a draft edits and a form version freezes: the form's title, description, ordered pages of question snapshots, and the conditions that decide what each respondent is shown.
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
The stable logical identity of a question across the versions of one form, held only while the question keeps its meaning. Two forms never share a question identity's history, even when one was duplicated from the other.
_Avoid_: Question ID, field key

**Question snapshot**:
The complete definition of a question as it exists within one form version.
_Avoid_: Question, field

**Option value**:
The stable machine-readable value of a choice option, distinct from its display label.
_Avoid_: Option key, option ID

**Row value**:
The stable machine-readable value of a matrix row, distinct from its display label, in the same way an option value is distinct from an option's label.
_Avoid_: Row key, row ID, statement ID

**Question type**:
The kind of a question snapshot, which fixes its answer representation and the kind of value it accepts. Constraints and display settings are not question types.
_Avoid_: Field type, widget

**Constraint**:
A setting on a question snapshot that narrows the values its question type accepts, such as a length, a range, a selection count, date bounds, or "must be yes".
_Avoid_: Validation rule, validator

**Display setting**:
A setting on a question snapshot that changes only the control the respondent uses, never the answer, such as a dropdown versus radio buttons, single-line versus multi-line text, or stars versus numerals.
_Avoid_: Variant, widget, appearance

**Availability**:
Whether a form currently accepts responses (open or closed), independent of its publication history.
_Avoid_: Status, active, enabled

**Builder**:
The administrative interface for creating forms, editing drafts and publishing form versions.
_Avoid_: Editor, designer, admin

**Renderer**:
The respondent-facing interface that displays one form version and collects or edits a response against it.
_Avoid_: Viewer, player, form widget

**Duplicate**:
Creating a new, never-published form whose draft starts from the definition of another form's version or draft.
_Avoid_: Clone, copy, template

**Restore**:
Replacing a form's draft with the definition of one of that form's own published versions.
_Avoid_: Revert, rollback, roll back

**Preview**:
Rendering a draft so an editor can try it, without ever creating a response.
_Avoid_: Test submission, dry run

**Condition**:
A test on a respondent's answers to earlier questions, naming them by question identity and option value, never by label or position. Conditions combine with "all" or "any", and groups of them can nest.
_Avoid_: Expression, formula, predicate

**Show condition**:
A condition on a question snapshot that decides whether the question is on the path once its page is reached. A question without one is always shown there.
_Avoid_: Visibility rule, display logic, show/hide

**Page**:
An ordered group of question snapshots that the respondent sees together. A form definition with no page breaks has a single page.
_Avoid_: Section, step, block, screen

**Jump**:
A move from the end of one page to a later page, or to the end of the form, taken when its condition holds. Jumps only go forward.
_Avoid_: Branch, skip, logic jump, go-to

## Collection

**Response**:
One submission against exactly one published form version.
_Avoid_: Submission, entry, result

**Answer**:
A respondent's answer to one question snapshot within a response. Values the respondent doesn't give, such as hidden fields, calculated scores, payments or bookings, are never answers.
_Avoid_: Value, field value

**Path**:
The questions one respondent is shown, in order, as decided by their form version's conditions and their own answers. A question off the path has no answer, and a required question is required only on the path.
_Avoid_: Flow, route, visible questions

**Skipped**:
Said of a question that was on a respondent's path but left unanswered. A question off the path was not shown, which is different from skipped.
_Avoid_: Unanswered, blank, hidden

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
