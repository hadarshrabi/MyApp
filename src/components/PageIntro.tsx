export function PageIntro({ title, text, action }: { title: string; text: string; action?: string }) {
  void action;
  return <section className="page-intro"><div><h2>{title}</h2><p>{text}</p></div></section>;
}
