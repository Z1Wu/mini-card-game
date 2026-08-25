import * as accomplice from './accomplice.mjs';
import * as alien from './alien.mjs';
import * as classRepresentative from './class-representative.mjs';
import * as criminal from './criminal.mjs';
import * as disciplineCommittee from './discipline-committee.mjs';
import * as harmony from './harmony.mjs';
import * as healthCommittee from './health-committee.mjs';
import * as homeClub from './home-club.mjs';
import * as honorStudent from './honor-student.mjs';
import * as infected from './infected.mjs';
import * as infectedDecline from './infected-decline.mjs';
import * as libraryCommittee from './library-committee.mjs';
import * as newsClub from './news-club.mjs';
import * as richGirl from './rich-girl.mjs';
import * as doubt from './doubt.mjs';
import * as studentCouncilPresident from './student-council-president.mjs';

/**
 * One module per card effect. Each module exports `name` (fixture name on the
 * server), `label`, optional `actorHandSize`, and `run(ctx)` returning
 * `{ evidence, actions?, extraCoverage? }`. The deterministic runner executes
 * them in this order; any of them can be selected alone via `--scenarios=`.
 */
export const SCENARIO_MODULES = [
  harmony,
  doubt,
  libraryCommittee,
  homeClub,
  healthCommittee,
  disciplineCommittee,
  newsClub,
  richGirl,
  accomplice,
  infected,
  infectedDecline,
  classRepresentative,
  honorStudent,
  criminal,
  studentCouncilPresident,
  alien,
];

const names = SCENARIO_MODULES.map((scenario) => scenario.name);
if (new Set(names).size !== names.length) throw new Error('Duplicate scenario module name in scenarios/index.mjs');
for (const scenario of SCENARIO_MODULES) {
  if (typeof scenario.run !== 'function') throw new Error(`Scenario ${scenario.name} does not export run()`);
}
