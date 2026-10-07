/**
 * Before/after samples per rule. `bad` texts must each produce at least one
 * violation of the rule; `good` texts must produce none. Most lines come from
 * the standard's own before/after tables.
 */
export interface RuleFixture {
  bad: string[];
  good: string[];
}

export const FIXTURES: Record<string, RuleFixture> = {
  "CES-P-001": {
    bad: ["The release shipped on time — a rare occurrence.", "Three pillars—speed, scale, and security—define the platform."],
    good: ["The release shipped on time, a rare occurrence.", "October 2023 – October 2025 uses an en dash."],
  },
  "CES-Q-001": {
    bad: ["It is actually faster than you might think.", "This is just an example.", "The result is really unexpected."],
    good: ["It is faster than you might think.", "Justice and reality are unrelated words.", "An adjustment is not a hedge."],
  },
  "CES-Q-002": {
    bad: ["I am genuinely excited about this role.", "The system is truly remarkable.", "She brings a deeply specialized skill set."],
    good: ["I am excited about this role.", "The system is remarkable.", "The truth is not a token here."],
  },
  "CES-C-001": {
    bad: [
      "It's not code, it's craft.",
      "We don't write documentation. We design experiences.",
      "The role isn't about buildout. It's about enablement.",
      "No meetings. No slides. Just code.",
      "What the metric really means is churn.",
      "But here's the thing nobody talks about: latency.",
    ],
    good: ["Write code that is correct, readable, and maintainable.", "The role covers buildout, enablement, and follow-through.", "This is not a drill."],
  },
  "CES-C-002": {
    bad: ["Fast, scalable, and reliable.", "We build, create, and deliver software."],
    good: ["Python, JavaScript, and TypeScript.", "The team ships on Monday, Wednesday, and Friday.", "Handles 10,000 requests per second with 99.95% uptime.", "Red, green, blue, and yellow are four colors."],
  },
  "CES-C-003": {
    bad: ["Prior experience backs this up: I built reporting dashboards at Lacek.", "It's worth noting that the cache is cold on the first request.", "The key thing is the index."],
    good: ["I built reporting dashboards at Lacek.", "The cache is cold on the first request."],
  },
  "CES-C-004": {
    bad: ["Publish it where the conversation is happening, and the reach takes care of itself.", "Both are fixable and measurable, which is the whole point.", "Ship it, and that's what matters."],
    good: ["Publish it where the conversation is happening.", "Both are fixable and measurable."],
  },
  "CES-C-005": {
    bad: ["I built operational reporting in SSRS. That's no accident.", "The tests pass on every commit. Which tells you everything you need to know.", "Instrumenting a workflow is the same muscle as instrumenting a funnel."],
    good: ["I built operational reporting in SSRS.", "That's a 40% reduction in build time."],
  },
  "CES-C-008": {
    bad: [
      "Worked directly with a blind user, grounding interface decisions in usability rather than abstract standards.",
      "The server tells the user that this server can't help, instead of calling the tool.",
      "The tool is not only fast but accurate.",
      "It's not just code.",
      "Onboarding is a path rather than a finish line.",
      "The design goes beyond the spec.",
    ],
    good: ["Worked directly with a blind user, grounding interface decisions in usability.", "The server tells the user that this server can't help.", "The topic is beyond the scope of this guide."],
  },
  "CES-V-001": {
    bad: ["Proven track record of delivering impactful outcomes.", "I would love to be considered for this role.", "A seamless, best-in-class experience."],
    good: ["Shipped the Xerxes conference portal; reduced an 8-person workflow to 1 dispatcher.", "Rewrote the test suite from 1,200 lines to 340."],
  },
  "CES-V-006": {
    bad: ["Let's dive in. The config file has three sections.", "Spoiler alert: the cache was cold.", "Pro tip: read the logs first."],
    good: ["The config file has three sections.", "The cache was cold."],
  },
  "CES-V-007": {
    bad: ["A template that doesn't fall apart on real projects.", "The pattern holds in practice.", "The checks run on every commit and the deploy waits for them to finish. Shipped."],
    good: ["State what the template was tested on.", "The real-time dashboard refreshes every second.", "The checks run on every commit. The deploy waits for them."],
  },
  "CES-V-008": {
    bad: ["Grounding interface decisions in usability, not standards alone.", "The change is merely cosmetic.", "A mere formality."],
    good: ["Grounding interface decisions in usability.", "She prefers working alone in the morning."],
  },
};
