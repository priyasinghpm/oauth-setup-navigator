import type {DiscoveryLink} from './discovery';
import { load } from 'cheerio';
import type { Topic } from './types';
export const TOPICS: Record<Topic, RegExp> = {
  'app-creation': /create.{0,40}(app|connection|integration)|app.{0,30}(configuration|registration)|client.{0,8}(id|secret)/i,
  'redirect-uris': /redirect.{0,8}(uri|url)|callback/i,
  scopes: /\bscopes?\b|permissions|capabilities/i,
  authorization: /oauth|authorization|access.token|refresh.token/i,
  review: /verification|security.review|app.review|approval/i,
  distribution: /marketplace|distribution|publish.{0,20}app/i,
  troubleshooting: /troubleshoot|invalid_grant|invalid_client|error.{0,12}(code|handling)|redirect_uri_mismatch/i,
};
export function relevance(value: string): number { return Object.values(TOPICS).reduce((score, regex) => score + (regex.test(value) ? 10 : 0), 0) + (/\/docs?\/|developer|\/guides?\/|\/reference\//i.test(value) ? 3 : 0); }
export function extractPage(body: string, url: string, type: string, maxTextChars: number) {
  if (/xml/.test(type) && !/xhtml/.test(type)) {
    const $ = load(body, { xml: true });
    return {title:'Sitemap',text:'',linkDetails:[] as DiscoveryLink[],links:$('loc').map((_, el) => $(el).text().trim()).get().slice(0,2000),topics:[] as Topic[],truncated:false,robots:''};
  }
  if (/text\/plain|markdown/.test(type)) {
    const links = [...body.matchAll(/https:\/\/[^\s<>\[\]()"']+/g)].map(m => m[0]);
    for (const match of body.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) links.push(match[1]);
    const linkDetails:DiscoveryLink[]=[...body.matchAll(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(m=>({href:m[2],text:m[1],context:''}));
    const text=body.trim();
    return {title:text.match(/^#\s+(.+)$/m)?.[1] ?? new URL(url).pathname, text:text.slice(0,maxTextChars),links:links.slice(0,2000),linkDetails:linkDetails.slice(0,2000),topics:topicsFor(text.slice(0,maxTextChars)),truncated:text.length>maxTextChars,robots:''};
  }
  const $=load(body);
  const robots=$('meta[name="robots"]').map((_,el)=>$(el).attr('content')??'').get().join(',');
  const title=$('title').first().text().trim() || $('h1').first().text().trim() || new URL(url).pathname;
  // Extract ordinary links only. Scripts, onclick handlers, forms and instructions never execute.
  const linkDetails:DiscoveryLink[]=$('a[href]').map((_,el)=>({href:$(el).attr('href')??'',text:$(el).text().trim().slice(0,200),context:($(el).closest('nav,header,footer,section').attr('aria-label')??'').slice(0,200),nofollow:/\bnofollow\b/i.test($(el).attr('rel')??'')})).get().slice(0,2000);
  const links=$('a[href]').map((_,el)=>$(el).attr('href') ?? '').get().slice(0,2000);
  $('script,style,noscript,iframe,template,svg,form,nav,header,footer,[hidden],[aria-hidden="true"]').remove();
  const content=$('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('body');
  // Link-only lists are discovery navigation, not supporting instructions.
  // Links were captured above; preserve prose that contains even short text.
  content.find('p,li,div,section').each((_,el)=>{
    if(!$(el).find('a[href]').length)return;
    const copy=$(el).clone();copy.find('a').remove();
    if(!copy.text().replace(/[\s|·•:,-]/g,''))$(el).remove();
  });
  // Preserve preformatted commands/configuration before normalizing prose.
  content.find('pre').each((_,el)=>{
    const code=$(el).text();const runs=code.match(/`+/g)??[];
    const fence='`'.repeat(Math.max(3,...runs.map(r=>r.length+1)));
    $(el).replaceWith($('<p>').text('\n\n'+fence+'\n'+code+'\n'+fence+'\n\n'));
  });
  content.find('h1,h2,h3,h4,p,li,tr,section,div,br').each((_,el)=>{ $(el).prepend('\n\n'); $(el).append('\n\n'); });
  content.find('h1,h2,h3,h4').each((_,el)=>{$(el).text('\n\n'+'#'.repeat(Number(el.tagName.slice(1)))+' '+$(el).text().trim()+'\n\n');});
  const extracted=content.text();const blocks=/^(`{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;
  let text='',offset=0;
  const prose=(v:string)=>v.replace(/[\t\r ]+/g,' ').replace(/\n[ \t]*\n(?:[ \t]*\n)*/g,'\n\n');
  for(const m of extracted.matchAll(blocks)){text+=prose(extracted.slice(offset,m.index))+m[0];offset=m.index!+m[0].length;}
  text=(text+prose(extracted.slice(offset))).trim();
  return {title:title.slice(0,300),text:text.slice(0,maxTextChars),links,linkDetails,topics:topicsFor(text.slice(0,maxTextChars)),truncated:text.length>maxTextChars,robots};
}
function topicsFor(text: string): Topic[] { return (Object.keys(TOPICS) as Topic[]).filter(topic=>TOPICS[topic].test(text)); }
