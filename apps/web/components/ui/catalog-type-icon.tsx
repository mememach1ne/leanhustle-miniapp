import type { CatalogTypeOption } from '@lean-poizon/shared';

const PATHS: Record<CatalogTypeOption | 'all', React.ReactNode> = {
  all: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  Sneakers: (
    <>
      <path d="M3 16.5V9l4 1.5L10 8l2 3 4 1.5 4.5 1.2c.9.3 1.5 1.1 1.5 2v.8H3z" />
      <path d="M3 19h19" />
    </>
  ),
  Jacket: (
    <>
      <path d="M9 3.5L5 5.5 3.5 20h5V11M15 3.5l4 2 1.5 14.5h-5V11" />
      <path d="M9 3.5L12 7l3-3.5M12 7v13" />
    </>
  ),
  Hoodie: (
    <>
      <path d="M8 5.5L4.5 7.5 3.5 20h17l-1-12.5L16 5.5" />
      <path d="M8 5.5a4 4 0 018 0c0 2.2-1.8 4-4 4s-4-1.8-4-4z" />
      <path d="M10.5 13h3" />
    </>
  ),
  'T-Shirt': <path d="M8 4l-4.5 3 2 4L7 10v10h10V10l1.5 1 2-4L16 4a4 4 0 01-8 0z" />,
  Pants: (
    <>
      <path d="M6.5 3.5h11L19 20.5h-4.5L12 9.5l-2.5 11H5z" />
      <path d="M6.5 7h11" />
    </>
  ),
  Shorts: (
    <>
      <path d="M5.5 5h13l1.5 10.5-6 1L12 10l-2 6.5-6-1z" />
      <path d="M5.5 8h13" />
    </>
  ),
  Bag: (
    <>
      <path d="M5 9h14l-1.2 11H6.2z" />
      <path d="M9 9V7a3 3 0 016 0v2" />
    </>
  ),
  Backpack: (
    <>
      <path d="M6 9a6 6 0 0112 0v11H6z" />
      <path d="M10 5V3.5h4V5M9 14h6v6H9z" />
    </>
  ),
  Cap: (
    <>
      <path d="M4 15a8 8 0 0116 0z" />
      <path d="M12 15h9.5M12 7V6" />
    </>
  ),
  Slides: (
    <>
      <path d="M4 15.5c0-2 1.5-3.5 3.5-3.5h9c2 0 3.5 1.5 3.5 3.5V17H4z" />
      <path d="M8 12V9.5a4 4 0 018 0V12" />
    </>
  ),
  Accessories: (
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 10v2l1.2 1.2M9 7l.5-4h5l.5 4M9 17l.5 4h5l.5-4" />
    </>
  ),
};

export function CatalogTypeIcon({
  type,
  className,
}: {
  type: CatalogTypeOption | 'all';
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[type]}
    </svg>
  );
}
