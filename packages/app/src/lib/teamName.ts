export interface NamedPerson {
  firstName: string;
  lastName: string;
}

/** A person's last name, or their first when they haven't got one (older single-word names). */
const label = (person: NamedPerson) => person.lastName.trim() || person.firstName.trim();

/**
 * The name a team gets when nobody types one: its members' last names joined with a
 * slash, captain first ("Kim", then "Kim/Lopez"). A team of more than two shows the first
 * two and a count ("Kim/Lopez +4") so a six-player roster doesn't become a paragraph.
 */
export function defaultTeamName(members: NamedPerson[]): string {
  const labels = members.map(label).filter(Boolean);
  if (labels.length <= 2) return labels.join("/");
  return `${labels.slice(0, 2).join("/")} +${labels.length - 2}`;
}
