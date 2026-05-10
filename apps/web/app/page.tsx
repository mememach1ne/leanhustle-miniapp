import { TAB_ROUTES } from '@lean-poizon/shared';
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect(TAB_ROUTES.CALCULATOR);
}
