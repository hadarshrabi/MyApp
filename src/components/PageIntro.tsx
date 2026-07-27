import { useApp } from "../context/AppContext";

export function PageIntro({ title, text, action }: { title: string; text: string; action?: string }) {
  const { openModal } = useApp();
  return <section className="page-intro"><div><h2>{title}</h2><p>{text}</p></div>{action && <button className="primary" onClick={() => openModal(action)}>{action}</button>}</section>;
}
