# Vancouver R3 site feasibility

**Live tool:** https://yeony7626.github.io/vancouver-r3-feasibility-study/

## Purpose

This tool is for architects, developers, or anyone curious about a lot in Vancouver's R3 zones.

R3 is new zoning on what used to be single-family neighbourhoods. It's a great opportunity to fill the
missing middle gap and bring density into the city slowly, one lot at a time.

It's also the perfect typology to test a single egress stair. With the recent regulatory change on single
egress, we can unlock more building types, and this is a good place to try it.

Pick a lot and the tool shows what fits: the largest massing the rules allow, a schematic plan, and
whether it works under the R3 rules and the building by-law's exit rules.

It's meant to get you excited and give you a sense of what's possible before design work starts.
It's not a permit review.

## How to use it

It runs in a web browser. There's nothing to install and no account or API key.

**Online:** open the link at the top of this page.

**On your own computer:**

1. Download or clone this repository.
2. Open a terminal in the project folder and start a local web server:

   ```bash
   npx http-server . -p 8766 -c-1
   ```

   This needs [Node.js](https://nodejs.org). Don't just double-click `index.html`: Chrome and Edge
   block the background worker the plan generator uses on pages opened from the file system.
3. Go to http://localhost:8766 in Chrome or Edge.

**Using the tool:**

1. **Welcome.** Press **Pick a site**, or **Open the example** to watch a finished run on 577 E 8th Av.
2. **Site.** Click an R3 parcel, or shift-click a neighbour to combine lots. The panel shows the site
   area, the permitted FSR, whether it's in a transit-oriented area, and whether the lot is big enough.
   Press **Continue to maximum massing**.
3. **1 · Massing.** The largest envelope the rules allow, as a site plan, section and 3D view. Change
   the storeys or the floor plate if you want, then **Continue to plan setup**.
4. **2 · Plan setup.** Answer a few questions (residential or mixed use, exit stairs, lifts, corridor
   layout, courtyard) and press **Generate plan**. It takes up to a minute.
5. **3 · Units.** The plan on every floor. Drag walls, split or merge units, move a stair. If an edit
   costs you something (lost unit types, floor area nothing can reach) a warning appears with Undo.
6. **4 · Review.** The verdict, the code table with clauses, exit distances and the unit mix.
   **Export study** gives a client sheet (print or save as PDF), a plan SVG or the study data.
7. **5 · Presentation.** A 3D view of the building in its block, which you can export as an image.

**Help** (a glossary of the terms the tool uses) is in the top bar on every step, or press `?`.
**Replay intro** is in the top bar of the site screen.

**Publishing it on GitHub Pages:** the live site comes from a separate public repository,
[vancouver-r3-feasibility-study](https://github.com/Yeony7626/vancouver-r3-feasibility-study), which holds only
the files the page loads, so notes, tests and reference images here stay private.
`node tools/build-site.cjs ../r3-site` assembles that copy; commit it to the public repository's `main` and
Pages (Settings → Pages → `main`, root) publishes it.

## Source

**Zoning: City of Vancouver Zoning and Development By-law, R3 Districts Schedule** (consolidated
July 2026). Only the rules in force now are used. The amendments dated 27 October 2026 (RTS 18516) are
encoded but turned off.

| What | Section |
|---|---|
| Minimum site area, 460 m² | §3.1.2.1 |
| Permitted FSR, by zone, tenure, site area column and site shape | §3.1.1 table (§3.1.1.2 to §3.1.1.5) |
| Height | §3.1.2.2 |
| Front, side and rear yards | §3.1.2.3 and §3.1.2.4 |
| Unit mix: at least 35% of homes with 2+ bedrooms, and 10% with 3+ in most cases | §2.2.6 |
| Transit-oriented areas | Transit-Oriented Areas Designation By-law 14090, approximated as 800 m from a rapid transit station |

Source: https://bylaws.vancouver.ca/zoning/zoning-by-law-district-schedule-r3.pdf

**Building code: Vancouver Building By-law 2025 (By-law No. 14343), Book I, Division B, Part 3**, in
effect since 15 September 2025. Read from the City's Volume 1 consolidation to 5 May 2026 (v4).

| What | Article |
|---|---|
| Construction type by storeys and building area (Group C, sprinklered) | 3.2.2.47 to 3.2.2.52 |
| At least two exits per floor | 3.4.2.1 |
| Distance between exits: half the floor diagonal, at most 9 m with a public corridor | 3.4.2.3.(1) |
| Travel distance to an exit: 45 m sprinklered, 30 m not, measured from the suite door | 3.4.2.4.(2), 3.4.2.5.(1) |
| Dead-end corridor, 6 m | 3.3.1.9.(5) |
| Public corridor width, 1,100 mm | 3.3.1.9.(1) |
| Scissor stair: residential throughout, up to 6 storeys and 600 m² building area; exit doors need not be more than 4.5 m apart | 3.4.2.3.(5)–(6) |
| Single exit stair: one exterior stair reached by an exterior passageway; up to 6 storeys and 18 m, 6 homes per floor on storeys 1–3 and 4 above, travel 25 m | Subsection 3.2.10 (By-law 14576, in force 20 January 2026) |

Also used:
- Single exit: the tool checks the storeys, homes per floor and travel it can measure. It draws the stair
  inside the plate, so Vancouver's exterior stair and passageway requirement is shown as unresolved, never
  as a pass.
- Courtyard width: City design guidelines (CDDG S1.4.3), applied by analogy.

**Site data:** City of Vancouver Open Data: property parcel polygons, zoning districts (dataset modified
29 June 2026) and rapid transit stations. Processed 18 September 2026: 5,697 R3 parcels.

## Example

**Input:** 577 E 8th Av. R3-3, 1,868 m², 100% rental, the default brief (residential, two exit stairs,
one lift, double-loaded corridor).

**Result** (screenshot at the top):
- Massing: 6 storeys, 18.0 m drawn plus a 0.6 m roof allowance, so 18.6 m against the 23 m limit.
- Plan: 51 homes (10 studios, 15 one-bed, 17 two-bed, 9 three-bed), 81.6% net to gross.
- FSR 2.396 against the permitted 2.40.
- Verdict: **Feasible as drawn. FSR sets the size, not height.** A 7th storey would go over the FSR.
  All 10 code checks pass, and 7 items are listed to verify.

## Limits

- It's a schematic check of a drawn plan, not a zoning or building code determination. Have the
  results reviewed by the City and a code consultant.
- It doesn't check fire separations, occupant load, stair and door dimensions, accessibility,
  spatial separation, or windows to every bedroom. Review lists these under **To verify**.
- Bedroom counts are capacity, not room layouts.
- Transit-oriented area status comes from distance to a station, not the enacted map. Check it
  against By-law 14090.
- Neighbouring buildings in the 3D view are estimates from parcel data.
- The plan generator searches a limited set of layouts. "Best" means best of the ones it tried.

Background on how the generator works, and each revision's changes, is in
[docs/development-notes.md](docs/development-notes.md).

## License

© 2026 Yeoneui Kim. All rights reserved. You can use the hosted tool to study sites, but
copying, changing or reusing the code needs my written permission. See [LICENSE](LICENSE).

The bundled map and 3D libraries, fonts and City of Vancouver open data keep their own
licences; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Contains information
licensed under the Open Government Licence – Vancouver.
