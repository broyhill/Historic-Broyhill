type PageHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
};

export function PageHeading({ eyebrow, title, description, note }: PageHeadingProps) {
  return (
    <header className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {note ? <span className="content-note">{note}</span> : null}
    </header>
  );
}
