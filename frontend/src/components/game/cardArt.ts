import classRepresentativeArt from '../../assets/art/cards/class-representative.webp';
import honorStudentArt from '../../assets/art/cards/honor-student.webp';
import infectedArt from '../../assets/art/cards/infected.webp';
import { CardType as RoleType } from '../../types/game';

/** Decorative art is opt-in: roles without a file retain their emblem-only card. */
export const roleArt: Partial<Record<RoleType, string>> = {
  [RoleType.CLASS_REP]: classRepresentativeArt,
  [RoleType.HONOR_STUDENT]: honorStudentArt,
  [RoleType.INFECTED]: infectedArt,
};
