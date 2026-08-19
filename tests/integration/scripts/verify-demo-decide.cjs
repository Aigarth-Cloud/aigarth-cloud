// Quick smoke test for the demo tissue — signs up + logs in, calls /decide, checks result.
const URL = "http://localhost:7001";
const TISSUE = "http://localhost:7008";

(async () => {
const email = "smoke-" + Date.now() + "@aigarth.cloud";
const password = "Smoke-Test-Password-1234!";

const signup = await fetch(URL + "/v1/auth/signup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, name: "Smoke Test" }),
});
console.log("signup:", signup.status);
if (!signup.ok) {
  const t = await signup.text();
  console.log("signup body:", t);
  process.exit(1);
}

const login = await fetch(URL + "/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
console.log("login:", login.status);
if (!login.ok) {
  const t = await login.text();
  console.log("login body:", t);
  process.exit(1);
}
const { access_token } = await login.json();

const r = await fetch(TISSUE + "/v1/tissues/tissue_executive_v1/decide", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer " + access_token },
  body: JSON.stringify({
    request_id: "verify-demo-1",
    input: { deal_size_qubic: 5_000_000, counterparty: "acme", region: "tt" },
    reversibility: "soft",
    time_horizon: "session",
  }),
});
console.log("decide:", r.status);
const body = await r.json();
console.log("envelope: state=" + body.envelope.state + " conf=" + body.envelope.confidence + " auth=" + body.envelope.authority);
console.log("contributors: " + (body.contributors || []).length + " ignored: " + (body.ignored || []).length);
console.log("policy: " + body.policy);
})();
