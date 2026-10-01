import accompliceArt from '../../assets/art/cards/accomplice-horror-v2.webp';
import alienArt from '../../assets/art/cards/alien-horror-v2.webp';
import classRepresentativeArt from '../../assets/art/cards/class-representative-horror-v2.webp';
import criminalArt from '../../assets/art/cards/criminal-horror-v2.webp';
import disciplineCommitteeArt from '../../assets/art/cards/discipline-committee-horror-v2.webp';
import healthCommitteeArt from '../../assets/art/cards/health-committee-horror-v2.webp';
import homeClubArt from '../../assets/art/cards/home-club-horror-v2.webp';
import honorStudentArt from '../../assets/art/cards/honor-student-horror-v2.webp';
import infectedArt from '../../assets/art/cards/infected-horror-v2.webp';
import libraryCommitteeArt from '../../assets/art/cards/library-committee-horror-v2.webp';
import newsClubArt from '../../assets/art/cards/news-club-horror-v2.webp';
import richGirlArt from '../../assets/art/cards/rich-girl-horror-v2.webp';
import studentCouncilPresidentArt from '../../assets/art/cards/student-council-president-horror-v2.webp';
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
