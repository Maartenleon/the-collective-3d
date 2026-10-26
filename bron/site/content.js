
  /* ================================================================
     CONTENT: the problems and the framework parts. Edit the words here; the problem cards, both side panels
     and the links between them are built from these two lists. Source: docs/SYMPTOMS.md of the 2D site.
     `short` is the card text, `line` the full quote as the panel title; `theme` is kept but not shown. `parts`: where the framework solves it
     (first = where it starts): p b m o r c; the figure beside the panel lights them.
     ================================================================ */
  // CONTACT: the address the About page shows, copies and opens in an email (Let's talk)
  const CONTACT = { email: "soundcheck@thecollective.nu", subject: "Sounds familiar" };

  const PROBLEMS = [
    { id: "everything-reports-green", theme: "Everyone is playing", parts: ["o", "p"],
      short: "Every report says green, but the numbers don’t move.",
      line: "Every project report says green, but the numbers that matter don’t move.",
      wrong: "Reports track activity and milestones, not results. Bad news travels up slowly, so a project turns red only when it is too late to act.",
      solve: "Orchestration ties every piece of work to a goal in the plan and asks one question each cycle: did the number move? Reporting shifts from ‘are we on track’ to ‘is it working’, and work that moves no goal is stopped." },
    { id: "never-stop-anything", theme: "Another new piece", parts: ["o", "p", "m"],
      short: "We start a lot. We almost never stop anything.",
      line: "We’re good at starting things. We almost never stop anything.",
      wrong: "There is no regular moment where the whole portfolio is reviewed and work is stopped. Not deciding becomes the decision, and capacity is spread thinner every month.",
      solve: "Orchestration sets a fixed rhythm for choosing what starts, what continues and what stops, weighed against the plan and the people actually available in the means. Stopping becomes a normal decision, not a failure." },
    { id: "projects-dont-pay-off", theme: "An expensive orchestra", parts: ["o", "p"],
      short: "We can’t tell whether our projects pay off.",
      line: "We can’t tell whether our projects actually pay off.",
      wrong: "Projects are approved on a business case, but nobody owns measuring the benefits once the money is spent. Success quietly becomes ‘delivered on time’.",
      solve: "The plan names the outcome each investment must move. Orchestration gives that outcome an owner in the business, who keeps reporting on it after go-live. Money then follows what works." },
    { id: "programme-keeps-growing", theme: "The never-ending symphony", parts: ["o", "b", "m"],
      short: "Our big programme is late and still growing.",
      line: "Our big programme is late, over budget, and still getting bigger.",
      wrong: "Scope, dependencies and capacity were never planned end to end, and business and IT don’t share ownership. Each team optimises its own part while the whole keeps growing.",
      solve: "The blueprint maps which capabilities and teams the change really touches, so dependencies show before they bite. Orchestration plans scope against the means that are actually there and makes the trade-offs out loud." },
    { id: "costs-creeping-up", theme: "More and more to play", parts: ["m", "b"],
      short: "Our costs keep creeping up, and nobody knows why.",
      line: "Our costs keep creeping up, especially IT, and nobody can tell me exactly why.",
      wrong: "Spend is spread across cloud, licences and teams that nobody oversees as a whole. New things are added; old ones are rarely switched off.",
      solve: "The means become visible as one whole: people, technology and spend, each linked to the capability in the blueprint it supports. Cost turns into a choice per capability, and what no longer serves anything can be switched off." },
    { id: "run-eats-the-budget", theme: "Playing ahead of the score", parts: ["m", "r", "c", "o"],
      short: "Keeping things running eats the budget for anything new.",
      line: "Most of our IT budget goes to keeping things running. There’s very little left for anything new.",
      wrong: "Old systems and quick fixes build up a maintenance bill that grows every year. Run and change draw on the same people and money, and run always wins because it cannot wait.",
      solve: "The framework splits the means openly between run and change, and the blueprint shows which old systems can be simplified or retired. Orchestration protects a share for change and pays down technical debt on purpose, not when something breaks." },
    { id: "two-of-everything", theme: "Two orchestras, one stage", parts: ["b", "p", "m"],
      short: "We merged, and still run two of everything.",
      line: "We merged two years ago, and we still run two of everything.",
      wrong: "The deal was integrated on paper: one name, one board. Nobody decided which processes, systems and teams become shared and which stay apart, so both keep running.",
      solve: "The blueprint draws the target: which capabilities are shared, which stay separate, and which teams own them. The plan sets the order, and the means move with it, one capability at a time." },
    { id: "benefits-never-showed-up", theme: "Who owns the music?", parts: ["o", "p", "b"],
      short: "The system went live, the benefits never showed up.",
      line: "The new system went live, but the benefits in the business case never showed up.",
      wrong: "Success was defined as go-live. The programme team moved on, and nobody in the business owns the promised outcome.",
      solve: "The plan defines success as the outcome, not the launch. The blueprint names the business owner of the changed process, and orchestration keeps measuring until the benefit is there, or decides to stop." },
  ];

  const PARTS = {
    p: { name: "Plan", sub: "the piece", question: "Are we working on the right things?", title: "What we want to play",
      text: "The plan holds the ambition, the choices and the goals. Most organisations have one, and it is usually good. Its weak point is the handover: it goes straight to the people who must carry it out, as a list of projects. A plan works when every goal lands somewhere it can be measured.",
      org: "Your strategy, turned into this year’s budget and a change portfolio for the years ahead.",
      concepts: ["Strategy", "OKRs", "Strategic prioritisation", "Portfolio management"] },
    b: { name: "Blueprint", sub: "the score", question: "Is it clear who owns what?", title: "What it takes to play it",
      text: "The blueprint is the intended design, on paper. It shows which capabilities the organisation needs, how value reaches the customer, how teams are shaped and who decides what. It is the only route from intending to doing. Skip it, and everyone plays the part they already knew.",
      org: "How value flows through your business, data and technology, and what it must grow into.",
      concepts: ["Value streams", "Business capabilities", "Operating model", "Organisational design", "Team Topologies"] },
    m: { name: "Means", sub: "the orchestra", question: "Do we have the people and money to do it?", title: "Who is in the chair tonight",
      text: "People, money, processes and technology. They are finite, and both run and change draw on them. Tonight’s concert and next season’s rehearsals use the same musicians and the same hours. That is why the two so often compete instead of cooperate.",
      org: "People, skills, tools and funding: who and what you have to run today and change for tomorrow.",
      concepts: ["Capacity planning", "Skills", "Technology landscape", "Spend management"] },
    o: { name: "Orchestration", sub: "the conductor", question: "Do we decide, stop and adjust in time?", title: "The whole, in motion",
      text: "The plan, the blueprint and the means running together, day to day. Orchestration is the rhythm of decisions that keeps them in step: what starts, what stops, and who gets the people when run and change collide. This is where we work, until the orchestra plays on its own.",
      org: "Leadership that decides what starts, what stops, and who gets the people when run and change collide.",
      concepts: ["Portfolio management", "Governance", "Decision rights"] },
    r: { name: "Run", sub: "tonight’s concert", question: "Does today’s work flow without us pushing it?", title: "Keep today’s value flowing",
      text: "Run is everything the organisation does today for its customers: sell, deliver, invoice, support. It needs stable value streams and clear ownership, steered by function, so that tonight’s concert is played well, every night.",
      org: "Run: keep today’s value flowing, with stable value streams steered by function.",
      concepts: ["Service management", "Operational excellence", "Lean", "Process ownership"] },
    c: { name: "Change", sub: "next season’s symphony", question: "Are we rehearsing what comes next?", title: "Build what comes next",
      text: "Change is the work that makes next season possible: new products, new processes, new systems. It works best in multidisciplinary teams around a value stream, with the means to deliver end to end, rehearsing while tonight’s concert still plays.",
      org: "Change: build what comes next, with multidisciplinary teams around a value stream and the means to deliver it end to end.",
      concepts: ["Team Topologies", "Value streams", "Product operating model", "Portfolio management"] },
  };

  const LABELS = {   // headings inside the side panels
    wrong: "Where it goes wrong", solve: "How the framework solves it", concepts: "Related concepts",
    org: "In your organisation", problems: "Problems it helps solve",
  };
