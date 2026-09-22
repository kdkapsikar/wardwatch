export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'citizen' ? '/my' : '/corporator');
