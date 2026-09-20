// Keep in sync with the CHECK constraints in db/migrations/001_init.sql
// and with client/src/lib/constants.js.
export const STATUSES = ['submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected'];

// Statuses a corporator may set ('submitted' is only ever the initial state).
export const CORPORATOR_STATUSES = ['acknowledged', 'in_progress', 'resolved', 'rejected'];

// Statuses that end an issue; they need an explanation for the citizen.
export const CLOSING_STATUSES = ['resolved', 'rejected'];

export const OPEN_STATUSES = ['submitted', 'acknowledged', 'in_progress'];

export const CATEGORIES = ['roads', 'water', 'sanitation', 'streetlights', 'drainage', 'parks', 'other'];

export const BCRYPT_ROUNDS = 12;
