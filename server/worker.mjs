import { createApi } from "./api-core.mjs";
import { D1Repository } from "./d1-repository.mjs";

export default {
  async fetch(request, env) {
    const apiResponse = await createApi(new D1Repository(env.DB))(request);
    if (apiResponse) return apiResponse;
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;
    const url = new URL(request.url);
    if (request.method === "GET" && !url.pathname.includes(".")) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }
    return response;
  },
};
