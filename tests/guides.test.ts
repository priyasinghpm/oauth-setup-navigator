import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guides } from '../lib/guides';
import { filterGuides } from '../lib/search';
import raw from '../data/guides.json';
import { parseGuides, guideEvidence } from '../lib/validate-guides';
test('default directory contains exactly the three expected providers', () => {
  assert.deepEqual(filterGuides(guides, '', 'all').map(g => g.slug), ['google-calendar', 'slack', 'notion']);
});
test('search matches names without case sensitivity and ignores surrounding whitespace', () => {
  assert.deepEqual(filterGuides(guides, '  SLacK  ', 'all').map(g => g.slug), ['slack']);
});
test('search includes summaries and keywords', () => {
  assert.equal(filterGuides(guides, 'consent configuration', 'all')[0]?.slug, 'google-calendar');
  assert.equal(filterGuides(guides, 'documents', 'all')[0]?.slug, 'notion');
});
test('provider and query filters combine, including no matches and reset values', () => {
  assert.equal(filterGuides(guides, 'workspace', 'notion').length, 1);
  assert.equal(filterGuides(guides, 'slack', 'notion').length, 0);
  assert.equal(filterGuides(guides, 'unmatched-query', 'all').length, 0);
  assert.equal(filterGuides(guides, '', 'all').length, 3);
});
test('researched guides have complete outcomes, dates, and evidence without test claims', () => {
  const today = '2026-11-03';
  const allSourceIds = new Set<string>();
  for (const g of guides) {
    assert.equal(g.verificationStatus, 'source-backed');
    assert.equal(g.oauthTestStatus, 'not-tested');
    assert.match(g.lastResearchedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(g.lastResearchedAt <= today);
    assert.equal(g.difficulty.evidence.status, 'estimated');
    assert.equal(g.setupEstimate.evidence.status, 'estimated');
    assert.match(g.setupEstimate.evidence.qualification!, /Excludes callback implementation, OAuth testing/);
    for (const step of g.steps) assert.ok(step.expectedOutcome.trim());
    for (const source of g.sources) {
      assert.ok(!allSourceIds.has(source.id)); allSourceIds.add(source.id);
      assert.ok(source.inspectedAt <= g.lastResearchedAt);
    }
    for (const e of guideEvidence(g)) {
      for (const id of e.sourceIds) assert.ok(g.sources.some(s => s.id === id));
      if (e.status === 'documented') assert.ok(e.sourceIds.length);
      else assert.ok(e.qualification?.trim());
    }
  }
});
test('approval durations stay tied to the specific documented review', () => {
  const google = guides.find(g => g.slug === 'google-calendar')!;
  const slack = guides.find(g => g.slug === 'slack')!;
  const notion = guides.find(g => g.slug === 'notion')!;
  assert.match(google.approvalWaitingTime.text, /sensitive-scope verification.*10 days/);
  assert.deepEqual(google.approvalWaitingTime.evidence.sourceIds, ['google-verification']);
  assert.equal(slack.approvalWaitingTime.evidence.status, 'unknown');
  assert.doesNotMatch(slack.approvalWaitingTime.text, /\d/);
  assert.match(notion.approvalWaitingTime.text, /Marketplace.*5–10 business days/);
  assert.match(notion.approvalWaitingTime.text, /response.*not guaranteed approval/);
  assert.deepEqual(notion.approvalWaitingTime.evidence.sourceIds, ['notion-marketplace']);
});
test('boundary rejects missing evidence, broken references, invalid dates, and duplicate identity', () => {
  const mutate = (change: (copy: typeof raw) => void) => { const copy = structuredClone(raw); change(copy); return copy; };
  assert.throws(() => parseGuides(mutate(copy => { copy[0].steps[0].evidence.sourceIds = []; })), /documented claims need sources/);
  assert.throws(() => parseGuides(mutate(copy => { copy[0].steps[0].evidence.sourceIds = ['missing']; })), /unknown source reference/);
  assert.throws(() => parseGuides(mutate(copy => { copy[0].lastResearchedAt = '2026-02-30'; })), /valid ISO date/);
  assert.throws(() => parseGuides(mutate(copy => { copy[1].slug = copy[0].slug; })), /duplicate slug/);
  assert.throws(() => parseGuides(mutate(copy => { copy[0].sources[1].id = copy[0].sources[0].id; })), /duplicate source ID/);
  assert.throws(() => parseGuides(mutate(copy => { copy[0].sources[0].url = 'https://example.com/docs'; })), /official HTTPS/);
  assert.throws(() => parseGuides(mutate(copy => { copy[0].verificationStatus = 'tested'; })), /must not imply/);
});
test('boundary rejects incomplete instructions and unexplained estimates', () => {
  const copy = structuredClone(raw);
  copy[0].steps[0].expectedOutcome = '';
  assert.throws(() => parseGuides(copy), /expectedOutcome/);
  const noExplanation = structuredClone(raw);
  noExplanation[0].setupEstimate.evidence.qualification = '';
  assert.throws(() => parseGuides(noExplanation), /qualification/);
  const invertedRange = structuredClone(raw);
  invertedRange[0].setupEstimate.maxMinutes = 1;
  assert.throws(() => parseGuides(invertedRange), /time range/);
});
