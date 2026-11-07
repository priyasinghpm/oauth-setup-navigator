export function ProviderMark({ slug, mark }: { slug: string; mark: string }) {
  return <span aria-hidden="true" className={`provider-mark ${slug}`}>{mark}</span>;
}
