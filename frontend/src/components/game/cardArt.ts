import accompliceArt from '../../assets/art/cards/accomplice-apocalypse-v1.webp';
import alienArt from '../../assets/art/cards/alien-apocalypse-v1.webp';
import classRepresentativeArt from '../../assets/art/cards/class-representative-apocalypse-v1.webp';
import criminalArt from '../../assets/art/cards/criminal-apocalypse-v1.webp';
import disciplineCommitteeArt from '../../assets/art/cards/discipline-committee-apocalypse-v1.webp';
import healthCommitteeArt from '../../assets/art/cards/health-committee-apocalypse-v1.webp';
import homeClubArt from '../../assets/art/cards/home-club-apocalypse-v1.webp';
import honorStudentArt from '../../assets/art/cards/honor-student-apocalypse-v1.webp';
import infectedArt from '../../assets/art/cards/infected-apocalypse-v1.webp';
import libraryCommitteeArt from '../../assets/art/cards/library-committee-apocalypse-v1.webp';
import newsClubArt from '../../assets/art/cards/news-club-apocalypse-v1.webp';
import richGirlArt from '../../assets/art/cards/rich-girl-apocalypse-v1.webp';
import studentCouncilPresidentArt from '../../assets/art/cards/student-council-president-apocalypse-v1.webp';
import { CardType as RoleType } from '../../types/game';

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

