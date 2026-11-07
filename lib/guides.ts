import data from '../data/guides.json';
import { parseGuides } from './validate-guides';
export const guides = parseGuides(data);
export const getGuide = (slug: string) => guides.find(guide => guide.slug === slug);
