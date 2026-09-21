// Create an admin or corporator account (the only way to add users in V1).
//
//   npm run user:create -w server -- admin <username> "<Full Name>"
//   npm run user:create -w server -- corporator <username> "<Full Name>" --constituency <number>
//
// The password is read from the WW_PASSWORD env var, or prompted for (hidden).
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import { pool, query } from '../src/db/pool.js';
import { BCRYPT_ROUNDS } from '../src/lib/constants.js';

const { positionals, values } = parseArgs({ allowPositionals: true, options: { constituency: { type: 'string' } } });
const [role, rawUsername, name] = positionals;
// Usernames are stored lowercase (login is case-insensitive either way).
const username = rawUsername?.trim().toLowerCase();

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error('Usage: user:create <admin|corporator> <username> "<Full Name>" [--constituency <number>]');
  process.exit(1);
}

/** Read a password without echoing it. Falls back to a plain line read when stdin is piped. */
function promptHidden(label) {
  process.stdout.write(label);
  return new Promise((resolve) => {
    let input = '';
    const { stdin } = process;
    const finish = () => {
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
      resolve(input);
    };
    const onData = (chunk) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return finish();
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); } // Ctrl-C
        if (ch === '\u007f' || ch === '\b') input = input.slice(0, -1);
        else input += ch;
      }
      return undefined;
    };
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main() {
  if (!['admin', 'corporator'].includes(role)) usage('role must be "admin" or "corporator"');
  if (!username || !name) usage('username and full name are required');

  let wardId;
  if (role === 'corporator') {
    if (!values.constituency) usage('--constituency <number> is required for corporators');
    const ward = await query('SELECT id FROM wards WHERE number = $1', [Number(values.constituency)]);
    if (!ward.rowCount) usage(`constituency ${values.constituency} does not exist`);
    wardId = ward.rows[0].id;
  }

  const password = process.env.WW_PASSWORD || (await promptHidden('Password (min 10 chars): '));
  if (password.length < 10) usage('password must be at least 10 characters');
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    if (role === 'admin') {
      await query('INSERT INTO admins (name, username, password_hash) VALUES ($1, $2, $3)', [name, username, hash]);
    } else {
      await query(
        'INSERT INTO corporators (ward_id, name, username, password_hash) VALUES ($1, $2, $3, $4)',
        [wardId, name, username, hash],
      );
    }
  } catch (err) {
    if (err.code === '23505') usage('that username (or, for corporators, that constituency) already has an account');
    throw err;
  }
  if (username !== rawUsername) console.log(`Note: username stored in lowercase ("${rawUsername}" -> "${username}").`);
  console.log(`Created ${role} "${username}".`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
