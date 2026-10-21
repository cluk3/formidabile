import "@fb/renderer/element";
import "./host.css";
import { projectGetToken } from "./project-token.ts";

// The host fills in the element for the project's one open form; the element reads `getToken` as a property.
const element = document.querySelector<HTMLElement>("form-renderer[data-project]");
const projectId = element?.dataset.project;
if (element && projectId !== undefined)
  Object.assign(element, { getToken: projectGetToken(projectId) });
