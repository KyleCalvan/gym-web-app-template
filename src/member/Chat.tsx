import GymQrLinks from '../shared/GymQrLinks.tsx';
import type { ViewProps } from '../types.ts';

export default function MemberContactLinks({ qrDestinations }: Pick<ViewProps, 'qrDestinations'>) {
  return <GymQrLinks destinations={qrDestinations} />;
}
