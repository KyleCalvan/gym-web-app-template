import GymQrLinks from '../shared/GymQrLinks.tsx';
import type { ViewProps } from '../types.ts';

export default function TrainerContactLinks({ qrDestinations }: Pick<ViewProps, 'qrDestinations'>) {
  return <GymQrLinks destinations={qrDestinations} />;
}
