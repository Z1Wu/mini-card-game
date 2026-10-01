import accompliceArt from '../../assets/art/cards/accomplice-soft-red-v3.webp';
import alienArt from '../../assets/art/cards/alien-soft-red-v3.webp';
import classRepresentativeArt from '../../assets/art/cards/class-representative-soft-red-v3.webp';
import criminalArt from '../../assets/art/cards/criminal-soft-red-v3.webp';
import disciplineCommitteeArt from '../../assets/art/cards/discipline-committee-soft-red-v3.webp';
import healthCommitteeArt from '../../assets/art/cards/health-committee-soft-red-v3.webp';
import homeClubArt from '../../assets/art/cards/home-club-soft-red-v3.webp';
import honorStudentArt from '../../assets/art/cards/honor-student-soft-red-v3.webp';
import infectedArt from '../../assets/art/cards/infected-soft-red-v3.webp';
import libraryCommitteeArt from '../../assets/art/cards/library-committee-soft-red-v3.webp';
import newsClubArt from '../../assets/art/cards/news-club-soft-red-v3.webp';
import richGirlArt from '../../assets/art/cards/rich-girl-soft-red-v3.webp';
import studentCouncilPresidentArt from '../../assets/art/cards/student-council-president-soft-red-v3.webp';
import { CardType as RoleType } from '../../types/game';

/** Match the illustrated grade neckerchief: first blue, second green, third red. */
export const roleGradeColor: Record<RoleType, string> = {
  [RoleType.CLASS_REP]: '#803941',
  [RoleType.LIBRARY_COMMITTEE]: '#405e48',
  [RoleType.ALIEN]: '#354b70',
  [RoleType.HOME_CLUB]: '#354b70',
  [RoleType.HEALTH_COMMITTEE]: '#405e48',
  [RoleType.DISCIPLINE_COMMITTEE]: '#803941',
  [RoleType.NEWS_CLUB]: '#405e48',
  [RoleType.RICH_GIRL]: '#803941',
  [RoleType.ACCOMPLICE]: '#405e48',
  [RoleType.INFECTED]: '#354b70',
  [RoleType.CRIMINAL]: '#803941',
  [RoleType.STUDENT_COUNCIL_PRESIDENT]: '#803941',
  [RoleType.HONOR_STUDENT]: '#354b70',
};

/** Decorative art for each role displayed on the card face. */
export const roleArt: Partial<Record<RoleType, string>> = {
  [RoleType.CLASS_REP]: classRepresentativeArt,
  [RoleType.LIBRARY_COMMITTEE]: libraryCommitteeArt,
  [RoleType.ALIEN]: alienArt,
  [RoleType.HOME_CLUB]: homeClubArt,
  [RoleType.HEALTH_COMMITTEE]: healthCommitteeArt,
  [RoleType.DISCIPLINE_COMMITTEE]: disciplineCommitteeArt,
  [RoleType.NEWS_CLUB]: newsClubArt,
  [RoleType.RICH_GIRL]: richGirlArt,
  [RoleType.ACCOMPLICE]: accompliceArt,
  [RoleType.INFECTED]: infectedArt,
  [RoleType.CRIMINAL]: criminalArt,
  [RoleType.STUDENT_COUNCIL_PRESIDENT]: studentCouncilPresidentArt,
  [RoleType.HONOR_STUDENT]: honorStudentArt,
};

/** Presentation grouping based on documented victory conditions; not player identity. */
export function roleFactionColor(role: RoleType): string {
  if (role === RoleType.CRIMINAL || role === RoleType.ACCOMPLICE) return '#c78f94';
  if (role === RoleType.INFECTED) return '#b6a0bd';
  if (role === RoleType.ALIEN) return '#9faec5';
  if (role === RoleType.HOME_CLUB) return '#c8b48e';
  return '#aebdac';
}
