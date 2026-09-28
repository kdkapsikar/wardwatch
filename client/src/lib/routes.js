/** Where a signed-in user lands: takes the whole `auth` object, since the admin role needs the
 *  sub-role (mayor/admin vs. a constituency-scoped Mandal Adhyaksh) to pick between two portals. */
export function homeFor(auth) {
  if (!auth) return '/';
  if (auth.role === 'citizen') return '/my';
  if (auth.role === 'corporator') return '/corporator';
  if (auth.role === 'admin') return auth.user.role === 'mandal_adhyaksh' ? '/mandal' : '/admin';
  return '/';
}
