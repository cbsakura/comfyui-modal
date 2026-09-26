import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const MODAL_PREFIX = "/comfymodal";

let _originalFetchApi = null;

function log(...args) {
  console.log("[comfyui-modal]", ...args);
}

app.registerExtension({
  name: "comfyui.modal",

  async setup() {
    log("Extension loaded. Patching fetchApi...");

    // Init the cloud/local flag here (not only when the sidebar panel
    // renders): the panel builds lazily when the tab is first opened, but
    // /prompt interception can happen before that. Without this, the flag
    // is `undefined` at startup and `!== false` misroutes saved-Local
    // mode to the cloud endpoint until the user toggles once.
    try {
      const saved = localStorage.getItem("comfymodal_enabled");
      if (window._comfyModalEnabled === undefined) {
        window._comfyModalEnabled = saved === null ? true : saved === "true";
      }
    } catch {
      if (window._comfyModalEnabled === undefined) window._comfyModalEnabled = true;
    }

    _originalFetchApi = api.fetchApi.bind(api);
    api.fetchApi = async function (route, options = {}) {
      const isPromptPost =
        options.method === "POST" &&
        (route === "/prompt" || route === "prompt");

      if (isPromptPost) {
        const enabled = window._comfyModalEnabled !== false;
        if (!enabled) {
          return _originalFetchApi(route, options);
        }
        log("Intercepted /prompt POST -> routing to Modal GPU");
        return _originalFetchApi(`${MODAL_PREFIX}/prompt`, options);
      }

      if (
        options.method === "POST" &&
        (route === "/model/install" || route === "model/install")
      ) {
        log("Intercepted model/install -> routing to Modal Volume download");
        return _originalFetchApi(`${MODAL_PREFIX}/model/install`, options);
      }

      return _originalFetchApi(route, options);
    };

    log("fetchApi patched. All /prompt POST requests -> Modal GPU.");
  },
});
