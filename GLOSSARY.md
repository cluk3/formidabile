# Form Management

A reusable, host-agnostic module for defining forms, publishing immutable versions of them, collecting responses against a specific version, and analysing those responses.

## Definitions

**Form**:
The stable identity of a form across all of its versions.
_Avoid_: Survey, questionnaire, template

**Form version**:
An immutable, self-contained snapshot of a form's definition, created at publication.
_Avoid_: Revision, release

**Draft**:
An editable working copy of a form's definition that has not been published.
_Avoid_: Unpublished version, working version

**Current published version**:
The form version that new submissions use by default.
_Avoid_: Latest version, active version

**Question identity**:
The stable logical identity of a question across form versions, held only while the question keeps its meaning.
_Avoid_: Question ID, field key

**Question snapshot**:
The complete definition of a question as it exists within one form version.
_Avoid_: Question, field

**Option value**:
The stable machine-readable value of a choice option, distinct from its display label.
_Avoid_: Option key, option ID

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

## Integration

**Host application**:
An application that embeds or calls the form module and owns its own domain, workflows, and authorization policies.
_Avoid_: Client app, consumer, parent app

**External reference**:
A generic pointer, made of a namespace and an identifier, from a form or response to an entity owned by a host application.
_Avoid_: Link, foreign key, association
