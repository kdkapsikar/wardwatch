import { createContext, useContext } from 'react';

/**
 * The Mandal Adhyaksh portal (`/mandal`) reuses every admin page component as-is (same dashboard,
 * same issue list, same notes) - only the data differs, which the server already scopes. The one
 * thing the shared components need to know is which URL prefix to link back into, so "View issues"
 * from `/mandal` stays on `/mandal/issues` instead of jumping to `/admin/issues`. Defaults to the
 * mayor/admin's own `/admin`; see App.jsx for where `/mandal` overrides it.
 */
const PortalContext = createContext({ basePath: '/admin' });

export const PortalProvider = PortalContext.Provider;
export const usePortal = () => useContext(PortalContext);
