import GymQrLinks from '../shared/GymQrLinks.tsx';
import type { ViewProps } from '../types.ts';

export default function MemberContactLinks({ qrDestinations, memberQrUrl }: Pick<ViewProps, 'qrDestinations' | 'memberQrUrl'>) {
  return <GymQrLinks destinations={qrDestinations} memberQrUrl={memberQrUrl} />;
}
