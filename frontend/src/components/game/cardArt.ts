import accompliceArt from '../../assets/art/cards/accomplice.webp';
import alienArt from '../../assets/art/cards/alien.webp';
import classRepresentativeArt from '../../assets/art/cards/class-representative.webp';
import criminalArt from '../../assets/art/cards/criminal.webp';
import disciplineCommitteeArt from '../../assets/art/cards/discipline-committee.webp';
import healthCommitteeArt from '../../assets/art/cards/health-committee.webp';
import homeClubArt from '../../assets/art/cards/home-club.webp';
import honorStudentArt from '../../assets/art/cards/honor-student.webp';
import infectedArt from '../../assets/art/cards/infected.webp';
import libraryCommitteeArt from '../../assets/art/cards/library-committee.webp';
import newsClubArt from '../../assets/art/cards/news-club.webp';
import richGirlArt from '../../assets/art/cards/rich-girl.webp';
import studentCouncilPresidentArt from '../../assets/art/cards/student-council-president.webp';
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
