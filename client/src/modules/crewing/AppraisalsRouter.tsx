import { useAppraisalsVersion } from './v2/hooks/useAppraisalsVersion';
import { ElementCrewAppraisals } from './ElementCrewAppraisals';
import { ElementCrewAppraisals_v2 } from './v2/ElementCrewAppraisals_v2';

export default function AppraisalsRouter() {
  const { isV2 } = useAppraisalsVersion();

  if (isV2) {
    return <ElementCrewAppraisals_v2 />;
  }

  return <ElementCrewAppraisals />;
}

export { ElementCrewAppraisals };
export { ElementCrewAppraisals_v2 } from './v2/ElementCrewAppraisals_v2';
export { useAppraisalsVersion } from './v2/hooks/useAppraisalsVersion';
