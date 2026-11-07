// Offline only. No SDK, keys, network, content repair or guide persistence.
import {readFileSync} from 'node:fs';
import {prepareSection,auditSection,sectionRequest} from './helpers/staged-section';
import {pipedriveSectionIds} from './helpers/pipedrive-section-evidence';
import {requestMetrics} from '../lib/generation/request-metrics';
const [snapshot,output]=process.argv.slice(2);
if(!snapshot||!output)throw new Error('Usage: node --import tsx scripts/audit-staged-section.ts <research-snapshot.json> <seven-excerpt-response.json>');
const prepared=prepareSection({provider:'Pipedrive',slug:'pipedrive',research:JSON.parse(readFileSync(snapshot,'utf8'))},pipedriveSectionIds);
const result=auditSection(JSON.parse(readFileSync(output,'utf8')),prepared);
console.log(JSON.stringify({note:'Use only a response made with this exact seven-excerpt registry. No evidence is repaired.',...result,metrics:requestMetrics(sectionRequest(prepared),prepared),realRequests:0},null,2));
