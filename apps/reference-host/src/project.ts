import "@fb/renderer/element";
import "./host.css";
import { projectGetToken } from "./project-token.ts";

// The host fills in the element for the project's one open form; the element reads `getToken` as a property.
const element = document.querySelector<HTMLElement>("form-renderer[data-project]");
const projectId = element?.dataset.project;
if (element && projectId !== undefined) {
  Object.assign(element, { getToken: projectGetToken(projectId) });
  // The renderer asks the respondent to sign in, and the host is the one that can: offer its sign-in page.
  element.addEventListener("error", (event) => {
    const { code } = (event as Event as CustomEvent<{ readonly code: string }>).detail;
    if (code !== "signInRequired" && code !== "sessionExpired") return;
    if (document.getElementById("sign-in")) return;
    const link = document.createElement("a");
    link.id = "sign-in";
    link.href = `/login?return=${encodeURIComponent(location.pathname)}`;
    link.textContent = "Sign in";
    const paragraph = document.createElement("p");
    paragraph.append(link);
    element.after(paragraph);
  });
}
