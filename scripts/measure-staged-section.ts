// Offline only: no SDK, key loading, transport, research or persistence.
import {readFileSync} from 'node:fs';
import type {ResearchResult} from '../lib/research/types';
import {prepareSection,sectionRequest} from './helpers/staged-section';
import {requestMetrics} from '../lib/generation/request-metrics';
import {pipedriveSectionIds} from './helpers/pipedrive-section-evidence';
const path=process.argv[2];
if(!path)throw new Error('Usage: node --import tsx scripts/measure-staged-section.ts <retained-research.json>');
// Trusted local artifact; preparation validates provenance and exact evidence.
const research:ResearchResult=JSON.parse(readFileSync(path,'utf8'));
const prepared=prepareSection({provider:'Pipedrive',slug:'pipedrive',research},pipedriveSectionIds);
console.log(JSON.stringify({metrics:requestMetrics(sectionRequest(prepared),prepared),evidence:prepared.sources.map(s=>({url:s.url,inspectedAt:s.inspectedAt,records:s.excerpts.map(e=>({id:e.id,selectionId:prepared.evidenceRegistry.find(r=>r.evidenceId===e.id)?.id,heading:e.sectionHeading,clipped:e.clipped}))})),realRequests:0},null,2));
