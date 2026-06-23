# Gridlock Hackathon 2.0 - Round 2

Last verified: 2026-06-19

## What This Round Is

This is **Round 2: Prototype Phase** of Flipkart's **Gridlock Hackathon 2.0** on HackerEarth. The official page states the hackathon has **three phases**:

1. An **online ML challenge**
2. A **real-world prototype phase** using localized Bengaluru traffic context
3. An **onsite finale at Flipkart HQ**

The Round 2 page is explicitly for participants who **cleared Round 1** and were **shortlisted for the prototype phase**.

## Official Snapshot

- Host: **Flipkart**
- Platform: **HackerEarth**
- Format: **Online** for Round 2
- Round name: **Prototype Round 2**
- Team size on event metadata: **1**
- Registrations shown on page at fetch time: **1,636**
- Support contact: **support@hackerearth.com**

## Critical Dates

The page shows the prototype round window as:

- **June 15, 2026, 10:00 PM to June 21, 2026, 11:59 PM**

The embedded event metadata also stores:

- `start_date`: **2026-06-15T16:30:00Z**
- `end_date`: **2026-06-21T18:29:00Z**

For India time, that aligns to:

- **Start:** June 15, 2026, 10:00 PM IST
- **End:** June 21, 2026, 11:59 PM IST

Do not cut this close. Treat **June 21, 2026 evening IST** as your hard freeze window.

## What You Are Expected To Do In Round 2

Officially, this round is about building a **working prototype** against **real Bengaluru traffic problems**.

The page imagery and description say shortlisted teams/participants should:

- Review the available **problem statements**
- Select **one** problem to solve
- Start building a **prototype**
- Submit the prototype **before the deadline**

## Prototype Phase Details

From the official Round 2 materials:

- You are expected to **build something real**, not just pitch an idea.
- The prototype phase is tied to **Bengaluru traffic challenges**.
- Participants get **localized datasets and partner resources** to build prototypes.
- Final prototypes are reviewed by an **expert panel**.

The official evaluation language emphasizes:

- **Feasibility**
- **Relevance**
- **Innovation**
- **Real-world impact**

Important clarification from the additional screenshots:

- One earlier official image says teams get **simulated datasets from HackerEarth**
- The partner section says teams also get **real-world data, infrastructure, and domain expertise**
- The Bengaluru Traffic Police partner card explicitly says teams solve authentic mobility challenges using **real data, not simulated scenarios**

The safest interpretation is:

- You should design for **real operational use**
- Expect at least some mix of **localized traffic data, mapping infrastructure, and domain-specific datasets**
- Do not build a toy solution that only works on synthetic examples

## Themes Visible In The Screenshots

The logged-in screenshots you provided expose at least these Round 2 themes.

### 1. Poor Visibility on Parking-Induced Congestion

Operational challenge:

- On-street illegal parking and spillover parking near commercial areas, metro stations, and events choke carriageways and intersections.

Why it is hard today:

- Enforcement is patrol-based and reactive
- No heatmap of parking violations vs. congestion impact
- Difficult to prioritize enforcement zones

Problem statement direction:

- Build AI-driven parking intelligence that detects illegal parking hotspots and quantifies their impact on traffic flow to enable targeted enforcement

Dataset note:

- A dataset link exists on the page, but the screenshot does not show the actual URL

### 2. Event-Driven Congestion (Planned & Unplanned)

Operational challenge:

- Political rallies, festivals, sports events, construction activities, and sudden gatherings create localized traffic breakdowns

Why it is hard today:

- Event impact is not quantified in advance
- Resource deployment is experience-driven
- No post-event learning system

Problem statement direction:

- Use historical and real-time data to forecast event-related traffic impact and recommend optimal manpower, barricading, and diversion plans

Dataset note:

- A dataset link exists on the page, but the screenshot does not show the actual URL

### 3. Automated Photo Identification and Classification for Traffic Violations Using Computer Vision

Overview:

- Build a practical computer-vision solution that analyzes large volumes of traffic images
- The goal is to reduce manual inspection effort and improve the efficiency and accuracy of traffic law enforcement

Objective:

- Automatically process traffic images
- Detect vehicles and road users
- Identify traffic violations
- Classify violation type
- Generate annotated evidence for review
- Remain robust across varying environmental conditions, traffic densities, and image qualities

Tasks shown in the screenshot:

1. Image preprocessing
   - Enhance image quality and normalize inputs
   - Handle low light, rain, shadows, and motion blur
2. Vehicle and road user detection
   - Detect and localize vehicles, riders, drivers, and pedestrians
   - Classify vehicle categories
3. Traffic violation detection
   - Helmet non-compliance
   - Seatbelt non-compliance
   - Triple riding
   - Wrong-side driving
   - Stop-line violation
   - Red-light violation
   - Illegal parking
4. Violation classification
   - Categorize violations into predefined classes
   - Assign confidence scores
5. License plate recognition
   - Detect number plates
   - Extract registration details using OCR
6. Evidence generation
   - Produce annotated images highlighting violations
   - Store violation metadata and timestamps
7. Analytics and reporting
   - Generate violation statistics and trends
   - Provide searchable records and summary reports
8. Performance evaluation
   - Evaluate using Accuracy, Precision, Recall, F1-score, and mAP
   - Assess computational efficiency and scalability

Expected outcome:

- A scalable AI-based traffic image analysis system that automatically identifies, classifies, and documents violations from photographic evidence, reducing manual effort and improving enforcement effectiveness

## Prizes

The screenshots expose the official prize pool:

- **Total prize pool:** **INR 500,000**

Main prizes:

- **First prize:** **INR 225,000**
- **Second prize:** **INR 175,000**
- **Third prize:** **INR 100,000**

Because the onsite finale notes say **in-person attendance is mandatory to remain prize-eligible**, treat travel/readiness for Bengaluru as part of your competition plan if you reach the Top 10.

## Partners And Data Context

The screenshots expose two named partners and what they contribute.

### MapmyIndia

What the partner card says:

- Provides access to proprietary **mapping technology**
- Provides **localized traffic intelligence**
- Teams leverage mapping infrastructure used across India's navigation, logistics, and urban planning systems

Practical implication:

- Location intelligence, route context, mapping overlays, corridor analysis, hotspot visualization, and geospatial UX are likely strong differentiators

### Bengaluru Traffic Police (ASTraM)

What the partner card says:

- Provides participants with **real-world traffic datasets**
- Datasets are built from extensive **urban traffic analysis** and **field intelligence**
- Teams solve authentic mobility challenges using **real data, not simulated scenarios**

Practical implication:

- If your prototype ignores operational enforcement realities, jurisdiction-level workflows, or evidence traceability, it will likely feel weaker than teams that build closer to traffic-police use cases

## Onsite Finale Details

If you qualify beyond Round 2:

- The **Top 10 teams** are invited to the **onsite finale at Flipkart HQ, Bengaluru**
- They pitch live before **subject-matter experts** and **Bengaluru Traffic Police leadership**
- **In-person attendance is mandatory** to remain **prize-eligible**
- Teams must deliver a **final presentation** and demonstrate a **working prototype**
- The official judging language for the finale covers:
  - **Solution robustness**
  - **Innovation**
  - **Prototype clarity**
  - **Scalability**
  - **Real-world viability for Bengaluru's traffic**
- The **Top 3** are felicitated by **Bengaluru Traffic Police leadership** and **Flipkart leadership**

## Submission Requirements

The FAQ on the official page says your submission should be built and packaged as follows:

- Build the application on your **local system**
- Submit it on HackerEarth in **tar/zip** format
- Include **source code**
- Include **instructions to run the application**

Useful implications:

- Your project must be **reviewable by judges without hand-holding**
- A broken setup is a major risk
- A strong `README.md` is part of the submission quality

## What Must Be Working

The official FAQ does **not** require the full product vision to be complete, but it does require that the submission be:

- **Functional**
- Good enough to be **reviewed by judges**

Prototype-only submissions are explicitly allowed:

- A complete production backend is **not mandatory**
- If you use a database, you may include a **database dump**
- You are still allowed to submit **just the prototype**

## Allowed Tech Stack

The official FAQ says:

- There is **no restriction** on language
- There is **no restriction** on technology stack
- There is **no restriction** on libraries

So choose the stack that maximizes:

- Speed of development
- Reliability in demo
- Ease of packaging
- Clarity for judges

## Availability / Participation Rules

The official FAQ says:

- You do **not** need to stay online for the full duration
- You do **not** need to remain logged into HackerEarth the whole time
- You can build locally and submit before the deadline

## Money / Eligibility / IP

From the official FAQ:

- Registration cost: **No fee**
- Qualification requirement: generic FAQ says **if you love to code, you can participate**
- IP: creators **retain IP ownership**
- However, code must be in the **public domain / open source for judge evaluation**

Important practical read:

- If your repo is private by default, be ready to make the judging artifact **open and reviewable**

## Solo vs Team Clarification

There is an important inconsistency in the official materials:

- The event metadata says **min team size = 1** and **max team size = 1**
- The public page header also shows **Team size: 1**
- But the FAQ includes generic HackerEarth text about **team submissions**

For this specific round, you should treat the event as **solo-only**, because the actual event configuration is more authoritative than the generic FAQ copy.

## What Was Missing From The Public Payload But Confirmed By Screenshots

The public HTML payload I fetched earlier did not expose some tab content directly, but your logged-in screenshots confirmed:

- At least **three visible themes/problem statements**
- The **INR 500,000** total prize pool
- The prize split of **225,000 / 175,000 / 100,000**
- Named partners: **MapmyIndia** and **Bengaluru Traffic Police (ASTraM)**

Still not confirmed from the screenshots:

- The full set of themes, if more exist below the captured region
- The actual destination URLs behind the visible **Dataset: Link** items
- Any extra prize categories beyond the main top 3 prizes

## What Judges Are Likely To Reward

This section is **inference from the official judging language**, not a direct quote.

To maximize your chance of winning, optimize for these:

1. **Clear Bengaluru fit**
   Your prototype should solve a concrete Bengaluru traffic pain point, not a generic smart-city idea.

2. **Working end-to-end flow**
   Even if narrow, the demo should complete a believable user journey without failures.

3. **Operational realism**
   Show how the solution would work with real constraints: congestion, routing, alerts, enforcement, dispatch, citizen reporting, or signal management.

4. **Robustness**
   Judges are explicitly told to value robustness. Avoid fragile demos, fake buttons, or unfinished flows.

5. **Scalability**
   Show how the approach could extend across junctions, corridors, time windows, or city systems.

6. **Prototype clarity**
   Make the demo self-explanatory. Judges should understand the problem, workflow, and outcome in minutes.

7. **Evidence of impact**
   Include metrics, simulated outcomes, before/after flows, or decision dashboards that make the impact legible.

## Best Submission Shape

Based on the official rules and likely judging pressure, the strongest submission package is:

- A **working prototype**
- A short **demo video** even though it is optional
- A sharp **README** with setup, run steps, architecture, and assumptions
- A clear statement of the **problem chosen**
- A concise explanation of **why this matters for Bengaluru**
- Screenshots or flows showing **core scenarios**
- If relevant, sample or simulated **data files**
- If relevant, **database dump**

## High-Risk Failure Modes

- Missing or confusing run instructions
- Prototype that cannot be launched quickly
- Generic solution with weak Bengaluru specificity
- Overbuilt architecture with underbuilt demo
- Nice interface but no real workflow
- Strong concept but no measurable impact story
- Last-minute submission issues on HackerEarth

## Recommended Execution Plan To Win

This is strategic advice inferred from the official requirements.

### Day 1

- Lock one problem statement fast
- Define one narrow but convincing workflow
- Decide the success metric you will claim
- Build the demo backbone first

### Day 2-3

- Make the core flow work reliably
- Add localized data and realism
- Build one decision-maker view and one operational output

### Day 4-5

- Improve robustness
- Add logging, fallback states, and seeded demo data
- Tighten the UI for clarity, not decoration

### Day 6

- Write the README
- Record the demo video
- Rehearse fresh setup from scratch

### Final Day

- Freeze scope early
- Package zip/tar cleanly
- Verify all run steps on a clean machine/environment
- Submit before the last hour

## Sources

1. Official HackerEarth Round 2 page:
   https://www.hackerearth.com/community/challenges/hackathon/gridlock-hackathon-20-round-2/?utm_campaign=gridlock-hackathon-20-round-2&utm_content=2674765&utm_medium=sprint_email&utm_source=sprint_admin

2. Official challenge cover/round image used on the page:
   https://uc.hackerearth.com/he-s3-ap-south-1/media/sprint/gridlock-hackathon-20-round-2/editor/editor_image_2674765_77e2b63.png

3. Official prototype/finale details image used on the page:
   https://uc.hackerearth.com/he-s3-ap-south-1/media/sprint/gridlock-hackathon-20-round-2/editor/editor_image_2674765_130424d.png

4. User-provided logged-in screenshots showing:
   - Themes tab content
   - Prize pool and prize split
   - Partner details for MapmyIndia and Bengaluru Traffic Police (ASTraM)

## Confidence Notes

- Timeline, format, solo size, FAQ rules, and finale structure are **verified from official page data**
- Themes, prize amounts, and partner details are **verified from your logged-in screenshots**
- The exact dataset URLs are **still not visible** in the screenshots provided
- The "how to win" sections are **my inference** from the official judging and format details
